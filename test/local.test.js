import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseCli, RECIPES } from '../bin/core.js';
import { deployPayload, runCloud } from '../bin/cloud.js';

test('deploy defaults to cwd when Dockerfile/package.json exists; --git restores origin; --local forces static folder', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cli-local-'));
  const runGit = (_bin, args) => ({ status: 0, stdout: args[0] === 'remote' ? 'git@git.test:a/b.git' : 'main' });
  try {
    for (const marker of ['Dockerfile', 'package.json']) {
      writeFileSync(join(cwd, marker), marker === 'package.json' ? '{}' : 'FROM node');
      assert.deepEqual(deployPayload({}, { cwd, runGit: () => { throw Error('local must not read git'); } }), { local_dir: cwd, env: {} });
      assert.equal(deployPayload({ git: true }, { cwd, runGit }).repo_url, 'https://git.test/a/b.git');
      assert.equal(deployPayload({ repo: 'https://git.test/explicit.git', branch: 'main' }, { cwd }).repo_url, 'https://git.test/explicit.git');
      rmSync(join(cwd, marker));
    }
    assert.equal(deployPayload({ local: true }, { cwd }).local_dir, cwd);
    assert.equal(deployPayload({}, { cwd, runGit }).repo_url, 'https://git.test/a/b.git');
    assert.equal(parseCli(['deploy', '--local', '--name', 'demo']).options.local, true);
    assert.equal(parseCli(['deploy', '--git']).options.git, true);
    for (const args of [['--local', '--git'], ['--local', '--repo', 'https://git.test/a/b'], ['--local', '--branch', 'main'], ['--local', '--app-host', 'host1']]) assert.throws(() => parseCli(['deploy', ...args]));
    assert.throws(() => deployPayload({ local: true, dockerfile: 'ops/Dockerfile' }, { cwd }), /Dockerfile/);
    assert.equal(RECIPES.find((r) => r.slug === 'app-tu-git').vi, 'Đưa app lên web (git hoặc thư mục)');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('local deploy detects, previews host price, obtains one approval, then prints final URL', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cli-local-flow-'));
  try {
    writeFileSync(join(cwd, 'package.json'), '{}');
    const calls = [], lines = []; let approvals = 0;
    const out = await runCloud('deploy', {}, { cwd, env: { MONACLOUD_WAIT_HTTPS: '0' }, print: (value) => lines.push(value), confirm: async () => { approvals++; assert.match(lines.at(-1), /hourly_rate_vnd/); return true; }, callTool: async (name, args) => {
      calls.push({ name, args });
      if (name === 'cloud_app_detect') return { stack: 'next', build_type: 'nixpacks', port: 3000, name: 'demo', env_required: ['DATABASE_URL'] };
      if (name === 'cloud_app_host_list') return { app_hosts: [] };
      if (name === 'cloud_balance') return { balance_vnd: 20000 };
      assert.equal(name, 'cloud_app_create');
      assert.deepEqual(args, { local_dir: cwd, env: {}, build_type: 'nixpacks', port: 3000, name: 'demo', sandbox: approvals === 0 });
      return { status: 'done', url: args.sandbox ? 'https://preview.test' : 'https://live.test', estimate: { hourly_rate_vnd: 100 } };
    } });
    assert.equal(approvals, 1); assert.equal(out.url, 'https://live.test'); assert.equal(lines.at(-1), out.url);
    assert.deepEqual(calls.map((r) => r.name), ['cloud_app_detect', 'cloud_app_host_list', 'cloud_app_create', 'cloud_balance', 'cloud_app_create']);
    assert.match(lines.join('\n'), /ZIP.*upload/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('local dry-run reuses host estimate without sending upload-only unsupported app_host_id', async () => {
  for (const dryRun of [true, false]) {
    const calls = [];
    await runCloud('deploy', { local: true, dryRun, yes: true }, { env: { MONACLOUD_WAIT_HTTPS: '0' }, print: () => {}, callTool: async (name, args) => {
      calls.push(name);
      if (name === 'cloud_app_detect') return { stack: 'static', build_type: 'static', port: 80, name: 'demo' };
      if (name === 'cloud_app_host_list') return { app_hosts: [{ id: 'h1', status: 'active', billing_mode: 'monthly' }] };
      if (name === 'cloud_balance') return {};
      assert.equal(args.app_host_id, undefined); assert.equal(args.sandbox, false); return { status: 'done', url: 'https://live.test' };
    } });
    assert.equal(calls.includes('cloud_app_create'), !dryRun);
  }
});

test('local sandbox stops on a failed job and does not print its URL as success', async () => {
  const lines = [];
  await assert.rejects(runCloud('deploy', { local: true, sandbox: true }, { env: { MONACLOUD_WAIT_HTTPS: '0' }, print: (line) => lines.push(line), callTool: async (name) => name === 'cloud_app_detect'
    ? { stack: 'static', build_type: 'static', port: 80, name: 'demo' }
    : { status: 'failed', url: 'https://bad.test', job_id: 'j1' },
  }), /chưa hoàn tất/);
  assert.ok(!lines.some((line) => line.includes('https://bad.test')));
});

const cliRoot = fileURLToPath(new URL('..', import.meta.url));
const mcpRoot = resolve(cliRoot, '../mcp');
test('CLI executable local cwd → real MCP ZIP → mock multipart upload, sandbox, approval, URL and failure', { skip: !existsSync(join(mcpRoot, 'dist/index.js')) && 'Build sibling MCP first' }, () => {
  const cwd = mkdtempSync(join(tmpdir(), 'cli-local-http-'));
  try {
    const executable = join(cwd, 'mcp'), trace = join(cwd, 'trace.jsonl');
    writeFileSync(join(cwd, 'package.json'), '{"scripts":{"start":"node index.js"}}');
    writeFileSync(join(cwd, 'index.js'), 'console.log("demo")');
    writeFileSync(join(cwd, '.env'), 'SECRET=never-upload');
    writeFileSync(join(cwd, 'key.pem'), 'never-upload');
    writeFileSync(join(cwd, '.gitignore'), 'mcp\ntrace.jsonl\n');
    writeFileSync(executable, `#!${process.execPath}\n(async()=>{await import(${JSON.stringify(join(mcpRoot, 'support/mock-wave-ab.mjs'))});await import(${JSON.stringify(join(mcpRoot, 'dist/index.js'))});})();\n`, { mode: 0o700 });
    const run = (args, extra = {}) => spawnSync(process.execPath, [join(cliRoot, 'bin/monacloud.js'), 'deploy', '--name', 'demo', ...args], { cwd, encoding: 'utf8', timeout: 15000, env: {
      ...process.env, MONACLOUD_WAIT_HTTPS: '0', NODE_USE_SYSTEM_CA: '0', MONACLOUD_MCP_BIN: executable, MONACLOUD_CONFIG_DIR: join(cwd, 'config'), MONACLOUD_TOKEN: 'fake-pass-only', VIBECLOUD_API_TOKEN: 'fake-compute-only', MONACLOUD_API: 'https://compute.test', MONACLOUD_BILLING_URL: 'https://billing.test', MONACLOUD_SANDBOX: '', WAVE_AB_TRACE: trace, ...extra,
    } });
    const preview = run(['--sandbox']); assert.equal(preview.status, 0, preview.stderr); assert.match(preview.stdout, /Sandbox \(0đ\): https:\/\/sandbox.test/);
    const denied = run([]); assert.equal(denied.status, 1); assert.match(denied.stderr, /Đã huỷ/);
    const dry = run(['--dry-run']); assert.equal(dry.status, 0, dry.stderr);
    const live = run(['--yes']); assert.equal(live.status, 0, live.stderr); assert.match(live.stdout, /https:\/\/deployed.test\n$/);
    const failed = run(['--yes'], { WAVE_AB_FAILURE: '1' }); assert.equal(failed.status, 1); assert.match(failed.stderr, /app_deploy_failed/); assert.doesNotMatch(failed.stdout, /https:\/\/deployed.test/);
    const requests = readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(requests.filter((r) => r.path === '/api/apps' && !r.sandbox).length, 2);
    assert.equal(requests.filter((r) => r.path === '/api/apps/local-app/upload' && !r.sandbox).length, 2);
    for (const out of [preview, denied, dry, live, failed]) assert.doesNotMatch(out.stdout + out.stderr, /fake-pass-only|fake-compute-only|never-upload/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
