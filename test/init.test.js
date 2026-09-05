import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { END_MARKER, START_MARKER, runDoctor } from '../bin/core.js';

const cli = new URL('../bin/monacloud.js', import.meta.url);
const temporaryDirectories = [];

function temporaryProject() {
  const directory = mkdtempSync(join(tmpdir(), 'monacloud-cli-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function run(directory, ...args) {
  return spawnSync(process.execPath, [cli.pathname, ...args], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
}

function snapshot(directory, files) {
  return Object.fromEntries(files.map((file) => [file, readFileSync(join(directory, file), 'utf8')]));
}

test.after(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
});

test('init creates every default file in an empty project', () => {
  const directory = temporaryProject();
  const result = run(directory, 'init', '--yes');

  assert.equal(result.status, 0, result.stderr);
  const files = [
    'AGENTS.md',
    'CLAUDE.md',
    '.mcp.json',
    '.cursor/mcp.json',
    '.env.monacloud.example',
    '.gitignore',
  ];
  const contents = snapshot(directory, files);
  assert.match(contents['AGENTS.md'], /cloud_balance/);
  assert.match(contents['CLAUDE.md'], /monapay_create_qr/);
  assert.match(contents['.env.monacloud.example'], /MONACLOUD_ISSUER=/);
  assert.equal(contents['.gitignore'], '.env.monacloud\n');
  assert.deepEqual(JSON.parse(contents['.mcp.json']).mcpServers.monacloud, {
    command: 'npx',
    args: ['-y', 'monacloud-mcp'],
  });
  assert.deepEqual(JSON.parse(contents['.cursor/mcp.json']).mcpServers.monacloud, {
    command: 'npx',
    args: ['-y', 'monacloud-mcp'],
  });
  assert.match(result.stdout, /codex mcp add monacloud -- npx -y monacloud-mcp/);
  assert.match(result.stdout, /Dựng app bán hàng trên MONA Cloud/);
});

test('running init twice is idempotent and does not duplicate managed blocks', () => {
  const directory = temporaryProject();
  const first = run(directory, 'init', '--yes');
  assert.equal(first.status, 0, first.stderr);
  const files = [
    'AGENTS.md',
    'CLAUDE.md',
    '.mcp.json',
    '.cursor/mcp.json',
    '.env.monacloud.example',
    '.gitignore',
  ];
  const before = snapshot(directory, files);

  const second = run(directory, 'init', '--yes');
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(snapshot(directory, files), before);
  assert.equal(before['AGENTS.md'].split(START_MARKER).length - 1, 1);
  assert.equal(before['AGENTS.md'].split(END_MARKER).length - 1, 1);
  assert.match(second.stdout, /0 file thay đổi/);
});

test('init with a recipe adds one independent recipe block to both agent files', () => {
  const directory = temporaryProject();
  const args = ['init', '--yes', '--recipe', 'web-ban-hang'];
  const first = run(directory, ...args);
  assert.equal(first.status, 0, first.stderr);

  const files = ['AGENTS.md', 'CLAUDE.md'];
  const before = snapshot(directory, files);
  for (const content of Object.values(before)) {
    assert.equal(content.split('<!-- monacloud:start -->').length - 1, 1);
    assert.equal(content.split('<!-- monacloud:recipe:web-ban-hang:start -->').length - 1, 1);
    assert.equal(content.split('<!-- monacloud:recipe:web-ban-hang:end -->').length - 1, 1);
    assert.match(content, /cloud_balance/);
    assert.match(content, /cloud_vps_create/);
    assert.match(content, /cloud_db_create/);
    assert.doesNotMatch(content, /vibecloud_/);
    assert.match(content, /monapay_create_qr/);
    assert.match(content, /monapay_create_webhook/);
    assert.match(content, /MONA Mail chưa mở — dùng cách tạm:/);
  }

  const second = run(directory, ...args);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(snapshot(directory, files), before);
  assert.match(second.stdout, /0 file thay đổi/);
});

test('invalid recipe prints every valid slug and writes nothing', () => {
  const directory = temporaryProject();
  const result = run(directory, 'init', '--yes', '--recipe', 'saas-thu-phi');

  assert.equal(result.status, 2);
  for (const slug of [
    'phan-mem-noi-bo',
    'web-ban-hang',
    'bot-cskh',
    'landing-form-lead',
    'tro-ly-chu-ca',
  ]) assert.match(result.stderr, new RegExp(slug));
  assert.throws(() => readFileSync(join(directory, 'AGENTS.md')), { code: 'ENOENT' });
});

test('recipes command prints seven lines in three groups', () => {
  const directory = temporaryProject();
  const result = run(directory, 'recipes');

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.split('\n').filter((line) => /^  \S+ — /.test(line)).length, 7);
  assert.match(result.stdout, /Quản trị doanh nghiệp:[\s\S]*phan-mem-noi-bo/);
  assert.match(result.stdout, /Marketing & bán hàng:[\s\S]*web-ban-hang[\s\S]*bot-cskh[\s\S]*landing-form-lead/);
  assert.match(result.stdout, /Trợ lý riêng của chủ:[\s\S]*tro-ly-chu-ca/);
  assert.doesNotMatch(result.stdout, /saas-thu-phi/);
});

test('existing AGENTS.md content is preserved around one managed block', () => {
  const directory = temporaryProject();
  const original = '# User rules\n\nKeep this exact instruction.\n';
  writeFileSync(join(directory, 'AGENTS.md'), original);

  const result = run(directory, 'init', '--yes', '--tool', 'codex');
  assert.equal(result.status, 0, result.stderr);
  const agents = readFileSync(join(directory, 'AGENTS.md'), 'utf8');
  assert.ok(agents.startsWith(original));
  assert.match(agents, /<!-- monacloud:start -->/);
  assert.match(agents, /<!-- monacloud:end -->/);
});

test('MCP JSON keeps unrelated root fields and servers', () => {
  const directory = temporaryProject();
  const original = {
    project: 'kept',
    mcpServers: {
      existing: { command: 'existing-server', args: ['serve'] },
    },
  };
  writeFileSync(join(directory, '.mcp.json'), JSON.stringify(original));
  mkdirSync(join(directory, '.cursor'), { recursive: true });
  writeFileSync(join(directory, '.cursor', 'mcp.json'), JSON.stringify(original));

  const result = run(directory, 'init', '--yes');
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['.mcp.json', '.cursor/mcp.json']) {
    const merged = JSON.parse(readFileSync(join(directory, name), 'utf8'));
    assert.equal(merged.project, 'kept');
    assert.deepEqual(merged.mcpServers.existing, original.mcpServers.existing);
    assert.deepEqual(merged.mcpServers.monacloud.args, ['-y', 'monacloud-mcp']);
  }
});

test('--dry-run prints diffs and writes nothing', () => {
  const directory = temporaryProject();
  const original = '# Existing\n';
  writeFileSync(join(directory, 'AGENTS.md'), original);

  const result = run(directory, 'init', '--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--- a\/AGENTS\.md/);
  assert.match(result.stdout, /\+\+\+ b\/\.mcp\.json/);
  assert.equal(readFileSync(join(directory, 'AGENTS.md'), 'utf8'), original);
  assert.throws(() => readFileSync(join(directory, 'CLAUDE.md')), { code: 'ENOENT' });
});

test('tool and language flags limit integration files and select English', () => {
  const directory = temporaryProject();
  const result = run(directory, 'init', '--yes', '--tool=claude', '--lang=en');

  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(join(directory, 'CLAUDE.md'), 'utf8'), /rules for AI agents/);
  assert.throws(() => readFileSync(join(directory, 'AGENTS.md')), { code: 'ENOENT' });
  assert.throws(() => readFileSync(join(directory, '.cursor/mcp.json')), { code: 'ENOENT' });
  assert.match(result.stdout, /Build a sales app on MONA Cloud/);
});

test('recipe follows tool and language selection', () => {
  const directory = temporaryProject();
  const result = run(
    directory,
    'init',
    '--yes',
    '--tool=claude',
    '--lang=en',
    '--recipe=bot-cskh',
  );

  assert.equal(result.status, 0, result.stderr);
  const claude = readFileSync(join(directory, 'CLAUDE.md'), 'utf8');
  assert.match(claude, /<!-- monacloud:recipe:bot-cskh:start -->/);
  assert.match(claude, /MONA Agent is not available yet — workaround:/);
  assert.throws(() => readFileSync(join(directory, 'AGENTS.md')), { code: 'ENOENT' });
});

test('invalid MCP JSON aborts before any file is written', () => {
  const directory = temporaryProject();
  writeFileSync(join(directory, '.mcp.json'), '{broken');

  const result = run(directory, 'init', '--yes');
  assert.equal(result.status, 2);
  assert.match(result.stderr, /not valid JSON/);
  assert.equal(readFileSync(join(directory, '.mcp.json'), 'utf8'), '{broken');
  assert.throws(() => readFileSync(join(directory, 'AGENTS.md')), { code: 'ENOENT' });
});

test('doctor executes a local MCP binary and inspects only token metadata', () => {
  const directory = temporaryProject();
  const executable = join(directory, 'monacloud-mcp-fixture');
  const executableLink = join(directory, 'monacloud-mcp');
  const configDirectory = join(directory, 'config');
  const tokenPath = join(configDirectory, 'token.json');
  mkdirSync(configDirectory, { recursive: true });
  writeFileSync(executable, '#!/usr/bin/env node\nconsole.log("9.8.7")\n', { mode: 0o755 });
  chmodSync(executable, 0o755);
  symlinkSync(executable, executableLink);
  writeFileSync(tokenPath, '{"access_token":"SECRET_MUST_NOT_APPEAR"}\n', { mode: 0o600 });
  chmodSync(tokenPath, 0o600);

  const result = runDoctor({
    cwd: directory,
    env: {
      ...process.env,
      MONACLOUD_MCP_BIN: executableLink,
      MONACLOUD_CONFIG_DIR: configDirectory,
    },
  });
  assert.equal(result.ok, true);
  const report = JSON.stringify(result);
  assert.match(report, /version 9\.8\.7/);
  assert.doesNotMatch(report, /SECRET_MUST_NOT_APPEAR/);
});
