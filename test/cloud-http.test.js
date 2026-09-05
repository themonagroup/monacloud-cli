import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const cliRoot = fileURLToPath(new URL('..', import.meta.url));
const mcpRoot = resolve(cliRoot, '../mcp');

test('CLI executable → real MCP → mock HTTP covers plans, monthly VPS, PDF, deploy and build errors', { skip: !existsSync(join(mcpRoot, 'dist/index.js')) && 'Build sibling mcp before this workspace integration test' }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'monacloud-http-'));
  try {
    const executable = join(cwd, 'mcp'), trace = join(cwd, 'trace.jsonl');
    writeFileSync(executable, `#!${process.execPath}\n(async()=>{await import(${JSON.stringify(join(mcpRoot, 'support/mock-wave-ab.mjs'))});await import(${JSON.stringify(join(mcpRoot, 'dist/index.js'))});})();\n`, { mode: 0o700 });
    const run = (args, extra = {}) => spawnSync(process.execPath, [join(cliRoot, 'bin/monacloud.js'), ...args], { cwd, encoding: 'utf8', timeout: 15000, env: {
      ...process.env, MONACLOUD_WAIT_HTTPS: '0', NODE_USE_SYSTEM_CA: '0', MONACLOUD_MCP_BIN: executable, MONACLOUD_CONFIG_DIR: join(cwd, 'config'),
      MONACLOUD_TOKEN: 'fake-pass-only', VIBECLOUD_API_TOKEN: 'fake-compute-only', MONACLOUD_API: 'https://compute.test', MONACLOUD_BILLING_URL: 'https://billing.test', MONACLOUD_SANDBOX: '', WAVE_AB_TRACE: trace, ...extra,
    } });
    for (const args of [['plans'], ['invoices'], ['vps', 'create', '--plan', 'kinh-doanh', '--monthly', '--name', 'shop', '--yes']]) {
      const result = run(args); assert.equal(result.status, 0, result.stderr); assert.equal(result.stderr, '');
      if (args[0] === 'plans') assert.match(result.stdout, /999\.000 đ.*9\.990\.000 đ/);
    }
    const pdf = run(['invoices', '--pdf', 'inv1']); assert.equal(pdf.status, 0, pdf.stderr);
    const path = pdf.stdout.trim();
    try { assert.deepEqual(readFileSync(path), Buffer.from('%PDF-1.4\n% mock binary \x00\xff\n%%EOF', 'binary')); }
    finally { rmSync(dirname(path), { recursive: true, force: true }); }
    const deploy = ['deploy', '--repo', 'https://git.test/team/shop.git', '--branch', 'release', '--build', 'nixpacks', '--domain', 'shop.test'];
    const denied = run(deploy); assert.equal(denied.status, 1); assert.match(denied.stderr, /Đã huỷ/);
    const preview = run([...deploy, '--sandbox']); assert.equal(preview.status, 0, preview.stderr); assert.match(preview.stdout, /Sandbox \(0đ\): https:\/\/sandbox.test/);
    const live = run([...deploy, '--yes']); assert.equal(live.status, 0, live.stderr); assert.match(live.stdout, /https:\/\/deployed.test\n$/);
    const failed = run([...deploy, '--yes'], { WAVE_AB_FAILURE: '1' }); assert.equal(failed.status, 1); assert.match(failed.stderr, /app_deploy_failed/); assert.doesNotMatch(failed.stdout, /https:\/\/deployed.test/);
    const requests = readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(requests.filter((r) => r.path === '/api/apps' && !r.sandbox).length, 2);
    assert.equal(requests.filter((r) => r.path === '/api/lxc').length, 1);
    for (const result of [live, failed, denied, preview]) assert.doesNotMatch(result.stdout + result.stderr, /fake-pass-only|fake-compute-only/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
