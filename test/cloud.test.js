import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseCli } from '../bin/core.js';
import { connectMcp, deployPayload, runCloud } from '../bin/cloud.js';

const plan = { code: 'kinh-doanh', cpu: 2, ram_gb: 4, disk_gb: 40, price_month_vnd: 999000, price_year_vnd: 9990000 };
const deployOptions = { repo: 'https://git.test/shop.git', branch: 'main', yes: true };
const output = () => { const lines = []; return { lines, print: (text) => lines.push(text) }; };

test('CLI accepts new commands and flags and rejects malformed values', () => {
  assert.equal(parseCli(['plans']).command, 'plans');
  assert.equal(parseCli(['vps', 'create', '--plan=kinh-doanh', '--monthly', '--period', 'year']).options.period, 'year');
  assert.equal(parseCli(['invoices', '--pdf', 'i1']).options.pdf, 'i1');
  assert.equal(parseCli(['deploy', '--build=static', '--sandbox']).options.sandbox, true);
  for (const args of [['plans', '--yes'], ['invoices', '--pdf'], ['vps', 'create', '--plan=x'], ['vps', 'delete'], ['vps', 'create', '--monthly', '--plan=x', '--period=week'], ['deploy', '--build=shell'], ['deploy', '--port=NaN'], ['deploy', '--port=65536'], ['deploy', '--branch']]) assert.throws(() => parseCli(args));
});

test('deploy reads actual local git origin and branch without a shell; overrides and detached HEAD work', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'monacloud-git-'));
  try {
    execFileSync('git', ['init', '-b', 'release'], { cwd, stdio: 'pipe' });
    execFileSync('git', ['remote', 'add', 'origin', 'git@git.test:team/shop.git'], { cwd });
    const payload = deployPayload({}, { cwd });
    assert.equal(payload.repo_url, 'https://git.test/team/shop.git'); assert.equal(payload.branch, 'release');
    assert.equal(payload.build_type, 'dockerfile'); assert.equal(payload.port, 3000);
    assert.equal(deployPayload({ ...deployOptions, build: 'nixpacks', port: '8080' }, { cwd }).port, 8080);
    assert.throws(() => deployPayload({ git: true }, { runGit: () => ({ status: 1 }) }), /origin/);
    assert.throws(() => deployPayload({ repo: deployOptions.repo }, { runGit: () => ({ status: 0, stdout: '' }) }), /--branch/);
    for (const repo of ['file:///etc/passwd', 'https://token@git.test/a/b', 'https://git.test/a/b?token=secret']) assert.throws(() => deployPayload({ repo, branch: 'main' }));
    assert.throws(() => deployPayload({ ...deployOptions, domain: 'https://shop.test' }), /hostname/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('plans show monthly and yearly prices; invoice PDF prints the local path', async () => {
  const out = output();
  await runCloud('plans', {}, { ...out, callTool: async (name) => { assert.equal(name, 'cloud_plan_list'); return { plans: [plan] }; } });
  assert.match(out.lines.join('\n'), /999\.000 đ.*9\.990\.000 đ/);
  await runCloud('invoices', { pdf: 'i/1' }, { ...out, callTool: async (name, args) => { assert.equal(name, 'cloud_invoice_pdf'); assert.deepEqual(args, { invoice_id: 'i/1' }); return { path: '/tmp/private/invoice.pdf' }; } });
  assert.equal(out.lines.at(-1), '/tmp/private/invoice.pdf');
});

test('VPS shows correct period quote before approval, creates monthly payload, waits for completion', async () => {
  const calls = [], out = output();
  let approved = false;
  await runCloud('vps', { plan: plan.code, period: 'year', name: 'shop' }, {
    ...out, env: { MONACLOUD_WAIT_HTTPS: '0' }, confirm: async () => { assert.match(out.lines.at(-1), /9\.990\.000 đ\/year/); approved = true; return true; },
    callTool: async (name, args) => {
      calls.push(name);
      if (name === 'cloud_plan_list') return { plans: [plan] };
      if (name === 'cloud_balance') return { balance_vnd: 9990000 };
      if (name === 'cloud_vps_create') { assert.equal(approved, true); assert.deepEqual(args, { app_name: 'shop', plan_code: plan.code, billing_mode: 'monthly', period: 'year', sandbox: false }); return { id: 'j1' }; }
      assert.equal(name, 'cloud_job_status'); return { status: 'done' };
    },
  });
  assert.deepEqual(calls, ['cloud_plan_list', 'cloud_balance', 'cloud_vps_create', 'cloud_job_status']);
});

test('VPS dry-run and refusal never create, sandbox skips approval and balance', async () => {
  for (const options of [{ dryRun: true }, {}, { sandbox: true }]) {
    const calls = [];
    const task = runCloud('vps', { plan: plan.code, ...options }, { print: () => {}, env: { MONACLOUD_WAIT_HTTPS: '0' }, callTool: async (name) => {
      calls.push(name); if (name === 'cloud_plan_list') return { plans: [plan] };
      if (name === 'cloud_vps_create') return { id: 'j1', sandbox: true };
      return { status: 'done' };
    } });
    if (!options.dryRun && !options.sandbox) await assert.rejects(task, /Đã huỷ/); else await task;
    assert.equal(calls.includes('cloud_vps_create'), !!options.sandbox);
    if (options.sandbox) assert.ok(!calls.includes('cloud_balance'));
  }
});

test('new host deploy previews in sandbox before approval and only prints real URL after completion', async () => {
  const calls = [], out = output(); let approved = false;
  await runCloud('deploy', { ...deployOptions, yes: false, build: 'static', domain: 'shop.test' }, {
    ...out, env: { MONACLOUD_WAIT_HTTPS: '0' }, confirm: async () => { approved = true; assert.match(out.lines.at(-1), /hourly_rate_vnd/); return true; },
    callTool: async (name, args) => {
      calls.push({ name, args });
      if (name === 'cloud_app_host_list') return { app_hosts: [] };
      if (name === 'cloud_balance') return { balance_vnd: 10000 };
      assert.equal(name, 'cloud_app_create');
      assert.equal(args.build_type, 'static'); assert.equal(args.domain, 'shop.test');
      if (args.sandbox) { assert.equal(approved, false); return { status: 'done', url: 'https://sandbox.test', estimate: { hourly_rate_vnd: 100 } }; }
      assert.equal(approved, true); return { status: 'done', url: 'https://real.test' };
    },
  });
  assert.deepEqual(calls.map((c) => c.name), ['cloud_app_host_list', 'cloud_app_create', 'cloud_balance', 'cloud_app_create']);
  assert.equal(out.lines.at(-1), 'https://real.test');
});

test('existing host is reused without new host preview; dry-run does not mutate', async () => {
  for (const dryRun of [true, false]) {
    const calls = [];
    await runCloud('deploy', { ...deployOptions, dryRun }, { print: () => {}, env: { MONACLOUD_WAIT_HTTPS: '0' }, callTool: async (name, args) => {
      calls.push(name);
      if (name === 'cloud_app_host_list') return { app_hosts: [{ id: 'host1', status: 'active', hourly_rate_vnd: 12 }] };
      if (name === 'cloud_balance') return {};
      assert.equal(args.app_host_id, 'host1'); assert.equal(args.sandbox, false);
      return { status: 'succeeded', result: { url: 'https://real.test' } };
    } });
    assert.equal(calls.filter((name) => name === 'cloud_app_create').length, dryRun ? 0 : 1);
  }
});

test('sandbox mode from flag or env makes only a sandbox request and labels the URL', async () => {
  for (const sandbox of [true, false]) {
    const out = output(), calls = [];
    await runCloud('deploy', { ...deployOptions, sandbox }, { ...out, env: sandbox ? {} : { MONACLOUD_SANDBOX: '1' }, callTool: async (name, args) => {
      calls.push(name); assert.equal(args.sandbox, true); return { status: 'done', url: 'https://sandbox.test', estimate: { hourly_rate_vnd: 100 } };
    } });
    assert.deepEqual(calls, ['cloud_app_create']); assert.match(out.lines.join('\n'), /Sandbox \(0đ\): https:\/\/sandbox.test/);
  }
});

test('missing estimate, rejected approval, rollout errors and timeout never result in duplicate live deployment', async () => {
  for (const mode of ['no-estimate', 'refused', 'rollout', 'timeout', 'failed']) {
    let live = 0; const out = output();
    await assert.rejects(runCloud('deploy', { ...deployOptions, yes: mode !== 'refused' }, {
      ...out, env: { MONACLOUD_WAIT_HTTPS: '0' }, callTool: async (name, args) => {
        if (mode === 'rollout') throw new Error('rollout_pending');
        if (name === 'cloud_app_host_list') return [];
        if (name === 'cloud_balance') return {};
        if (args.sandbox) return { status: 'done', url: 'https://sandbox.test', ...(mode !== 'no-estimate' ? { estimate: { hourly_rate_vnd: 1 } } : {}) };
        live += 1; return { status: mode === 'failed' ? 'failed' : 'running', polling: 'timeout', job_id: 'j1' };
      },
    }));
    assert.equal(live, ['timeout', 'failed'].includes(mode) ? 1 : 0);
    assert.ok(!out.lines.includes('https://real.test'));
  }
});

test('stdio MCP bridge initializes, calls tools, propagates API errors and closes the child', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'monacloud-bridge-'));
  try {
    const executable = join(cwd, 'mcp');
    writeFileSync(executable, `#!${process.execPath}\nimport('node:readline').then(({createInterface}) => {
      createInterface({input:process.stdin}).on('line', line => {
        const request=JSON.parse(line); if(!request.id)return;
        let result=request.method==='initialize'?{protocolVersion:'2024-11-05',serverInfo:{name:'mock',version:'0.4.0'},capabilities:{tools:{}}}:{content:[{type:'text',text:JSON.stringify(request.params.name==='cloud_plan_list'?{plans:[]}: {code:'not_found',message:'Missing invoice',next_step:'List invoices'})}],isError:request.params.name!=='cloud_plan_list'};
        process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,result})+'\\n');
      });
    });\n`, { mode: 0o700 });
    const mcp = await connectMcp({ cwd, env: { ...process.env, MONACLOUD_MCP_BIN: executable } });
    try { assert.deepEqual(await mcp.callTool('cloud_plan_list'), { plans: [] }); await assert.rejects(mcp.callTool('cloud_invoice_pdf', { invoice_id: 'missing' }), /not_found: Missing invoice\nList invoices/); }
    finally { mcp.close(); }
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
