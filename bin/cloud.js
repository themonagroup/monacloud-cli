import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { basename } from 'node:path';
import { CliError, findExecutable } from './core.js';

// A small stdio MCP client keeps compute/auth/spend-guard logic in monacloud-mcp.
// The fallback is explicitly offline: runtime commands never install packages.
export async function connectMcp({ env = process.env, cwd = process.cwd() } = {}) {
  const executable = findExecutable('monacloud-mcp', env, cwd);
  const npx = executable ? null : findExecutable('npx', { ...env, MONACLOUD_MCP_BIN: '' }, cwd);
  if (!executable && !npx) throw new CliError('Cần monacloud-mcp >=0.3.0 cài local hoặc có trong npm cache; chạy monacloud doctor.', 1);
  const child = spawn(executable || npx, executable ? [] : ['--offline', '--yes', '--package=monacloud-mcp', '--', 'monacloud-mcp'], {
    cwd, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
  });
  child.stderr.resume(); // Never echo a child token or secret from diagnostics.
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  let nextId = 0;
  let stopped = false;
  const fail = (message) => {
    stopped = true;
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new CliError(message, 1)); }
    pending.clear();
  };
  child.on('error', () => fail('Không chạy được monacloud-mcp; kiểm tra monacloud doctor.'));
  child.on('exit', () => fail('monacloud-mcp đã dừng; kiểm tra bản >=0.3.0 và monacloud doctor.'));
  child.stdin.on('error', () => fail('Mất kết nối stdio với monacloud-mcp.'));
  lines.on('line', (line) => {
    let message;
    try { message = JSON.parse(line); } catch { fail('MCP trả JSON không hợp lệ.'); return; }
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new CliError(message.error.message || 'MCP request failed.', 1));
    else item.resolve(message.result);
  });
  const send = (message) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...message })}\n`);
  const request = (method, params, timeout = 660_000) => new Promise((resolve, reject) => {
    if (stopped) { reject(new CliError('MCP connection closed.', 1)); return; }
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new CliError('MCP timeout. Kiểm tra job hiện có trước khi retry; không tạo app trùng.', 1));
    }, timeout);
    pending.set(id, { resolve, reject, timer });
    send({ id, method, params });
  });
  const close = () => { fail('MCP connection closed.'); lines.close(); child.stdin.end(); child.kill(); };
  try {
    const init = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'monacloud-cli', version: '0.3.0' } }, 15_000);
    const parts = String(init?.serverInfo?.version || '').split('.').map(Number);
    if (!(parts[0] > 0 || parts[0] === 0 && parts[1] >= 3)) throw new CliError('Cần monacloud-mcp >=0.3.0 cho lệnh compute.', 1);
    send({ method: 'notifications/initialized' });
  } catch (error) { close(); throw error; }
  return {
    close,
    async callTool(name, args = {}) {
      const result = await request('tools/call', { name, arguments: args });
      const raw = result?.content?.find((item) => item.type === 'text')?.text;
      let data;
      try { data = JSON.parse(raw); } catch { throw new CliError('MCP không trả JSON text.', 1); }
      if (result.isError) throw new CliError(`${data.code || 'tool_error'}: ${data.message || raw}${data.next_step ? `\n${data.next_step}` : ''}`, 1);
      return data;
    },
  };
}

export function parseCloudOptions(command, args) {
  const options = { help: false, sandbox: false, yes: false, dryRun: false };
  const values = command === 'vps'
    ? ['plan', 'name', 'period']
    : command === 'deploy' ? ['repo', 'branch', 'build', 'domain', 'app-host', 'port', 'dockerfile']
      : command === 'invoices' ? ['pdf'] : [];
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i];
    if (['--help', '-h'].includes(argument)) { options.help = true; continue; }
    if (['vps', 'deploy'].includes(command) && ['--sandbox', '--yes', '-y', '--dry-run'].includes(argument)) {
      options[argument === '--sandbox' ? 'sandbox' : argument === '--dry-run' ? 'dryRun' : 'yes'] = true;
      continue;
    }
    if (command === 'vps' && argument === '--monthly') { options.monthly = true; continue; }
    const [flag, ...rest] = argument.split('=');
    const name = flag.replace(/^--/, '');
    if (!flag.startsWith('--') || !values.includes(name)) throw new CliError(`Unknown option: ${argument}`);
    const value = rest.length ? rest.join('=') : args[++i];
    if (!value || value.startsWith('--')) throw new CliError(`${flag} requires a value.`);
    options[name] = value;
  }
  if (options.help) return options;
  if (command === 'vps') {
    if (!options.monthly || !options.plan) throw new CliError('Dùng vps create --plan <code> --monthly [--period month|year].');
    if (options.period && !['month', 'year'].includes(options.period)) throw new CliError('--period must be month or year.');
    if (options.name && (options.name.length < 2 || options.name.length > 80)) throw new CliError('--name requires 2–80 characters.');
  }
  if (options.build && !['dockerfile', 'nixpacks', 'static'].includes(options.build)) throw new CliError('--build must be dockerfile, nixpacks or static.');
  if (options.port !== undefined && (!/^\d+$/.test(options.port) || Number(options.port) < 1 || Number(options.port) > 65535)) throw new CliError('--port must be 1–65535.');
  return options;
}

function gitValue(args, cwd, runGit) {
  const result = runGit('git', args, { cwd, encoding: 'utf8', timeout: 10_000, windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : '';
}

export function deployPayload(options, { cwd = process.cwd(), runGit = spawnSync } = {}) {
  let repo_url = options.repo || gitValue(['remote', 'get-url', 'origin'], cwd, runGit);
  if (!repo_url) throw new CliError('Không tìm thấy git remote origin; truyền --repo <url>.');
  // Wave B accepts public HTTPS repositories. Common SSH remotes map to the same public URL.
  const scp = repo_url.match(/^git@([a-zA-Z0-9.-]+):([^\s]+)$/);
  if (scp) repo_url = `https://${scp[1]}/${scp[2]}`;
  let validRepo = false;
  try {
    let url = new URL(repo_url);
    if (url.protocol === 'ssh:' && url.username === 'git' && !url.password && !url.port && !url.search && !url.hash) {
      repo_url = `https://${url.hostname}${url.pathname}`;
      url = new URL(repo_url);
    }
    validRepo = url.protocol === 'https:' && !url.password && !url.username && !url.port && !url.search && !url.hash && url.pathname.length > 1;
  } catch { /* SCP-style SSH URLs are checked above. */ }
  if (!validRepo) throw new CliError('--repo cần public HTTPS git URL không chứa token hoặc mật khẩu (SSH remote thông dụng được đổi sang HTTPS).');
  const branch = options.branch || gitValue(['branch', '--show-current'], cwd, runGit);
  if (!branch) throw new CliError('Không tìm thấy nhánh hiện tại (ngoài repo hoặc detached HEAD); truyền --branch <name>.');
  if (options.domain && !/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$/.test(options.domain)) throw new CliError('--domain chỉ nhận hostname, không URL/path.');
  return { repo_url, branch, build_type: options.build || 'dockerfile', dockerfile: options.dockerfile || 'Dockerfile',
    env: {}, port: Number(options.port || 3000), ...(options.domain ? { domain: options.domain } : {}),
    ...(options['app-host'] ? { app_host_id: options['app-host'] } : {}) };
}

const rows = (value, key) => {
  const data = value?.data ?? value;
  return Array.isArray(data) ? data : data?.[key] || data?.items || [];
};
const money = (value) => typeof value === 'number' ? `${value.toLocaleString('vi-VN')} đ` : 'chưa có giá';
function completed(result, label) {
  if (result.polling === 'timeout' || !['done', 'succeeded'].includes(result.status)) {
    throw new CliError(`${label} chưa hoàn tất (${result.status || 'unknown'}). Gọi cloud_job_status job_id=${result.job_id || result.id || '?'}; không tạo lại.`, 1);
  }
}

export async function runCloud(command, options, {
  callTool, confirm = async () => false, print = console.log, cwd = process.cwd(), runGit = spawnSync, env = process.env,
} = {}) {
  const isSandbox = options.sandbox || env.MONACLOUD_SANDBOX === '1';
  const approve = async (summary) => {
    print(summary);
    if (!options.yes && !await confirm('Duyệt chi phí và thực hiện? [y/N] ')) throw new CliError('Đã huỷ; chưa thực hiện lệnh thật. Dùng --yes nếu đã duyệt chi phí.', 1);
  };
  if (command === 'plans') {
    const result = await callTool('cloud_plan_list');
    print('Gói | CPU/RAM/đĩa | Tháng | Năm');
    for (const plan of rows(result, 'plans')) print(`${plan.code} | ${plan.cpu}c/${plan.ram_gb}GB/${plan.disk_gb}GB | ${money(plan.price_month_vnd)} | ${money(plan.price_year_vnd)}${plan.admin_only ? ' (admin gán)' : ''}`);
    if (result.recommendation) print(`Gợi ý: ${result.recommendation.plan_code}. ${result.recommendation.reason}`);
    return result;
  }
  if (command === 'invoices') {
    const result = options.pdf ? await callTool('cloud_invoice_pdf', { invoice_id: options.pdf }) : await callTool('cloud_invoice_list');
    print(options.pdf ? result.path : JSON.stringify(result, null, 2));
    return result;
  }
  if (command === 'vps') {
    const plans = rows(await callTool('cloud_plan_list'), 'plans');
    const plan = plans.find((row) => row.code === options.plan && row.active !== false);
    if (!plan) throw new CliError('Không tìm thấy gói; chạy monacloud plans.');
    const period = options.period || 'month';
    const amount = plan[period === 'year' ? 'price_year_vnd' : 'price_month_vnd'];
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) throw new CliError('Không có giá gói hợp lệ.');
    const name = options.name || basename(cwd).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 80).padEnd(2, 'x');
    const summary = `${name}: ${plan.code}, ${plan.cpu} CPU/${plan.ram_gb}GB RAM/${plan.disk_gb}GB đĩa, ${money(amount)}/${period}.`;
    if (options.dryRun) { print(summary); return { estimate_vnd: amount, period }; }
    if (!isSandbox) { await callTool('cloud_balance'); await approve(summary); }
    const result = await callTool('cloud_vps_create', { app_name: name, plan_code: plan.code, billing_mode: 'monthly', period, sandbox: isSandbox });
    const jobId = result.job_id || result.id;
    if (!jobId) throw new CliError('API không trả job_id; kiểm cloud_services_list trước khi retry.', 1);
    const job = await callTool('cloud_job_status', { job_id: jobId, sandbox: isSandbox, timeout_sec: 600 });
    completed(job, 'VPS');
    print(JSON.stringify({ ...job, estimate: result.estimate }, null, 2));
    return job;
  }
  const payload = deployPayload(options, { cwd, runGit });
  print('App từ git: repo public → URL https trong ~1–3 phút (app host đầu tiên mất thêm ~2 phút).');
  if (isSandbox) {
    const preview = await callTool('cloud_app_create', { ...payload, sandbox: true });
    if (preview.polling === 'timeout') completed(preview, 'Sandbox');
    const url = preview.url || preview.result?.url;
    if (!url) throw new CliError('Sandbox chưa trả URL; kiểm tra job trước khi retry.', 1);
    print(`Sandbox (0đ): ${url}`);
    print(JSON.stringify({ estimate: preview.estimate || preview.result?.estimate || preview.estimated_cost }, null, 2));
    return preview;
  }
  const hosts = rows(await callTool('cloud_app_host_list'), 'app_hosts');
  const host = payload.app_host_id
    ? hosts.find((row) => (row.id || row.service_id) === payload.app_host_id)
    : hosts.find((row) => row.status === 'active' && (!row.power_state || row.power_state === 'running') && (!row.app_host_status || row.app_host_status === 'ready'));
  if (payload.app_host_id && !host) throw new CliError('Không tìm thấy --app-host trong tài khoản.');
  if (host && (host.status !== 'active' || host.power_state && host.power_state !== 'running' || host.app_host_status && host.app_host_status !== 'ready')) throw new CliError('App host chưa sẵn sàng; đọc cloud_services_list và start host trước khi deploy.');
  if (!host && hosts.length) throw new CliError('Chưa có app host sẵn sàng; đọc cloud_services_list và start host trước khi deploy.');
  let estimate;
  if (host) {
    payload.app_host_id = host.id || host.service_id;
    estimate = { existing_app_host: payload.app_host_id, hourly_rate_vnd: host.hourly_rate_vnd, billing_mode: host.billing_mode, note: 'Dùng host hiện có; phí host tiếp tục theo kỳ đang dùng.' };
  } else {
    const preview = await callTool('cloud_app_create', { ...payload, sandbox: true });
    if (preview.polling === 'timeout') completed(preview, 'Sandbox');
    estimate = preview.estimate || preview.result?.estimated_app_host || preview.result?.estimate || preview.estimated_cost;
    if (!estimate) throw new CliError('Sandbox chưa trả ước tính app host; chưa tạo thật. Đọc cloud_packages/cloud_prices rồi thử lại.', 1);
  }
  const summary = `${payload.repo_url} (${payload.branch}, ${payload.build_type})\n${JSON.stringify(estimate, null, 2)}`;
  if (options.dryRun) { print(summary); return { estimate }; }
  await callTool('cloud_balance');
  await approve(summary);
  const result = await callTool('cloud_app_create', { ...payload, sandbox: false });
  if (result.polling === 'timeout') completed(result, 'Deploy');
  const url = result.url || result.result?.url;
  if (!url || !['done', 'succeeded'].includes(result.status)) completed(result, 'Deploy');
  if (!url) throw new CliError('Job xong nhưng chưa có URL; đọc cloud_app_get.', 1);
  print(url);
  return result;
}
