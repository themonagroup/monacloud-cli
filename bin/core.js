import { parseCloudOptions } from './cloud.js';
import { spawnSync } from 'node:child_process';
import {
  accessSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '0.3.0';
export const START_MARKER = '<!-- monacloud:start -->';
export const END_MARKER = '<!-- monacloud:end -->';
export const ENV_START_MARKER = '# monacloud:start';
export const ENV_END_MARKER = '# monacloud:end';
export const REGISTRATION_URL = 'https://pass.monacloud.vn/realms/mona/protocol/openid-connect/registrations';

export const RECIPES = Object.freeze([
  Object.freeze({ slug: 'app-tu-git', group: 'business', vi: 'Deploy repo git thành app có HTTPS (đang mở)', en: 'Deploy a git repository with HTTPS (rollout in progress)' }),
  Object.freeze({
    slug: 'phan-mem-noi-bo',
    group: 'business',
    vi: 'CRM / chấm công / kho / báo cáo cho công ty mình',
    en: 'CRM, attendance, inventory and internal reporting',
  }),
  Object.freeze({
    slug: 'web-ban-hang',
    group: 'sales',
    vi: 'Web/app bán hàng, chuyển khoản tự báo có',
    en: 'A store or sales app with automatic bank-transfer confirmation',
  }),
  Object.freeze({
    slug: 'bot-cskh',
    group: 'sales',
    vi: 'Bot CSKH/chốt đơn trên Zalo hoặc Telegram',
    en: 'A customer-care and sales bot for Zalo or Telegram',
  }),
  Object.freeze({
    slug: 'landing-form-lead',
    group: 'sales',
    vi: 'Landing page, form lead và luồng nhắc khách',
    en: 'A landing page, lead form and follow-up flow',
  }),
  Object.freeze({
    slug: 'tro-ly-chu-ca',
    group: 'owner',
    vi: 'Trợ lý đọc số bán, nhắc việc, soạn thư và canh dòng tiền',
    en: 'An owner assistant for sales, tasks, drafts and cash flow',
  }),
  Object.freeze({
    slug: 'gui-mail-otp',
    group: 'sales',
    vi: 'Gửi mail OTP, xác nhận đơn và thông báo bằng MONA Mail',
    en: 'OTP, order confirmation and notification email with MONA Mail',
  }),
]);

const MCP_SERVER = Object.freeze({
  command: 'npx',
  args: ['-y', 'monacloud-mcp'],
});

const ENV_TEMPLATE = `# Endpoints used by monacloud-mcp
MONACLOUD_ISSUER=https://pass.monacloud.vn/realms/mona
MONACLOUD_BILLING_URL=https://billing.monacloud.vn
MONAPAY_API=https://api.monapay.vn
MONACLOUD_API=https://api.monacloud.vn
MONAMAIL_API=https://api.monamail.vn
MONACLOUD_CONSOLE_URL=https://monacloud.vn/console

# OAuth defaults
MONACLOUD_CLIENT_ID=monacloud-mcp
MONACLOUD_SCOPE=openid profile email product billing-api offline_access

# Optional overrides. Never commit a real token.
# MONACLOUD_TOKEN=
# MONACLOUD_CONFIG_DIR=
# MONACLOUD_TEMPLATES_DIR=
# MONACLOUD_TEMPLATES_URL=
# MONAPAY_LINK_PATH=/api/v1/client/oauth/mona-id/link
# VIBECLOUD_API=https://api.monacloud.vn
# VIBECLOUD_LINK_PATH=/api/auth/monaid/link`;

const VALID_TOOLS = new Set(['claude', 'codex', 'cursor', 'all']);
const VALID_LANGS = new Set(['vi', 'en']);
const VALID_RECIPES = new Set(RECIPES.map(({ slug }) => slug));

export class CliError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

function countOccurrences(value, needle) {
  let count = 0;
  let offset = 0;
  while ((offset = value.indexOf(needle, offset)) !== -1) {
    count += 1;
    offset += needle.length;
  }
  return count;
}

export function mergeManagedBlock(current, body, startMarker = START_MARKER, endMarker = END_MARKER) {
  const cleanBody = body.trim();
  const block = `${startMarker}\n${cleanBody}\n${endMarker}`;
  const startCount = countOccurrences(current, startMarker);
  const endCount = countOccurrences(current, endMarker);

  if (startCount === 0 && endCount === 0) {
    if (current.length === 0) return `${block}\n`;
    const separator = current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
    return `${current}${separator}${block}\n`;
  }

  if (startCount !== 1 || endCount !== 1) {
    throw new CliError(`Managed MONA Cloud block is malformed (${startMarker} / ${endMarker}). Fix the markers and retry.`);
  }

  const start = current.indexOf(startMarker);
  const end = current.indexOf(endMarker);
  if (end < start) {
    throw new CliError(`Managed MONA Cloud block has its end marker before its start marker (${startMarker}).`);
  }

  return `${current.slice(0, start)}${block}${current.slice(end + endMarker.length)}`;
}

function readOptional(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : null;
}

function readTemplate(lang) {
  const templatePath = fileURLToPath(new URL(`../templates/agent.${lang}.md`, import.meta.url));
  try {
    return readFileSync(templatePath, 'utf8').trim();
  } catch (error) {
    throw new CliError(`Cannot read bundled template ${templatePath}: ${error.message}`, 1);
  }
}

function recipeMarkers(slug) {
  return {
    start: `<!-- monacloud:recipe:${slug}:start -->`,
    end: `<!-- monacloud:recipe:${slug}:end -->`,
  };
}

function readRecipeTemplate(slug, lang) {
  const templatePath = fileURLToPath(new URL(`../templates/recipes/${slug}.${lang}.md`, import.meta.url));
  try {
    return readFileSync(templatePath, 'utf8').trim();
  } catch (error) {
    throw new CliError(`Cannot read bundled recipe template ${templatePath}: ${error.message}`, 1);
  }
}

function mergeMcpJson(current, relativePath) {
  let document = {};
  if (current !== null && current.trim() !== '') {
    try {
      document = JSON.parse(current.replace(/^\uFEFF/, ''));
    } catch (error) {
      throw new CliError(`${relativePath} is not valid JSON: ${error.message}`);
    }
  }

  if (document === null || Array.isArray(document) || typeof document !== 'object') {
    throw new CliError(`${relativePath} must contain a JSON object.`);
  }
  if (
    document.mcpServers !== undefined
    && (document.mcpServers === null || Array.isArray(document.mcpServers) || typeof document.mcpServers !== 'object')
  ) {
    throw new CliError(`${relativePath}: "mcpServers" must be a JSON object.`);
  }

  const servers = document.mcpServers || {};
  const merged = {
    ...document,
    mcpServers: {
      ...servers,
      monacloud: MCP_SERVER,
    },
  };
  return `${JSON.stringify(merged, null, 2)}\n`;
}

function mergeGitignore(current) {
  if (current === null || current.length === 0) return '.env.monacloud\n';
  const hasEntry = current.split(/\r?\n/).some((line) => line.trim() === '.env.monacloud');
  if (hasEntry) return current;
  const separator = current.endsWith('\n') ? '' : '\n';
  return `${current}${separator}.env.monacloud\n`;
}

function operation(cwd, relativePath, makeAfter) {
  const absolutePath = resolve(cwd, relativePath);
  const before = readOptional(absolutePath);
  const after = makeAfter(before);
  return { relativePath, absolutePath, before, after, changed: before !== after };
}

export function buildInitPlan({ cwd = process.cwd(), tool = 'all', lang = 'vi', recipe = null } = {}) {
  if (!VALID_TOOLS.has(tool)) throw new CliError(`Invalid --tool value: ${tool}`);
  if (!VALID_LANGS.has(lang)) throw new CliError(`Invalid --lang value: ${lang}`);
  if (recipe !== null && !VALID_RECIPES.has(recipe)) {
    throw new CliError(`Invalid --recipe value: ${recipe}. Valid recipes: ${RECIPES.map(({ slug }) => slug).join(', ')}.`);
  }

  const template = readTemplate(lang);
  const recipeTemplate = recipe === null ? null : readRecipeTemplate(recipe, lang);
  const operations = [];
  const mergeAgentFile = (before) => {
    let after = mergeManagedBlock(before || '', template);
    if (recipeTemplate !== null) {
      const markers = recipeMarkers(recipe);
      after = mergeManagedBlock(after, recipeTemplate, markers.start, markers.end);
    }
    return after;
  };

  if (tool === 'all' || tool === 'codex' || tool === 'cursor') {
    operations.push(operation(cwd, 'AGENTS.md', mergeAgentFile));
  }
  if (tool === 'all' || tool === 'claude') {
    operations.push(operation(cwd, 'CLAUDE.md', mergeAgentFile));
    operations.push(operation(cwd, '.mcp.json', (before) => mergeMcpJson(before, '.mcp.json')));
  }
  if (tool === 'all' || tool === 'cursor') {
    operations.push(operation(cwd, '.cursor/mcp.json', (before) => mergeMcpJson(before, '.cursor/mcp.json')));
  }

  operations.push(operation(cwd, '.env.monacloud.example', (before) => (
    mergeManagedBlock(before || '', ENV_TEMPLATE, ENV_START_MARKER, ENV_END_MARKER)
  )));
  operations.push(operation(cwd, '.gitignore', mergeGitignore));

  return operations;
}

function splitForDiff(value) {
  if (value === null || value === '') return [];
  const lines = value.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

export function formatDiff(item) {
  const beforeLines = splitForDiff(item.before);
  const afterLines = splitForDiff(item.after);
  const oldName = item.before === null ? '/dev/null' : `a/${item.relativePath}`;
  const newName = `b/${item.relativePath}`;
  const oldRange = beforeLines.length === 0 ? '0,0' : `1,${beforeLines.length}`;
  const newRange = afterLines.length === 0 ? '0,0' : `1,${afterLines.length}`;
  const removed = beforeLines.map((line) => `-${line}`);
  const added = afterLines.map((line) => `+${line}`);
  return [`--- ${oldName}`, `+++ ${newName}`, `@@ -${oldRange} +${newRange} @@`, ...removed, ...added].join('\n');
}

function writeAtomic(item) {
  mkdirSync(dirname(item.absolutePath), { recursive: true });
  const mode = item.before === null ? 0o666 : statSync(item.absolutePath).mode & 0o777;
  const temporaryPath = join(
    dirname(item.absolutePath),
    `.${item.relativePath.split('/').at(-1)}.monacloud-${process.pid}-${Date.now()}.tmp`,
  );
  try {
    writeFileSync(temporaryPath, item.after, { encoding: 'utf8', flag: 'wx', mode });
    renameSync(temporaryPath, item.absolutePath);
  } catch (error) {
    try {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write error.
    }
    throw error;
  }
}

export function applyInitPlan(plan, { dryRun = false } = {}) {
  const changed = plan.filter((item) => item.changed);
  if (!dryRun) changed.forEach(writeAtomic);
  return changed;
}

function parseValue(argument, name, args, index) {
  if (argument === name) {
    if (index + 1 >= args.length || args[index + 1].startsWith('-')) {
      throw new CliError(`${name} requires a value.`);
    }
    return { value: args[index + 1], consumed: 1 };
  }
  if (argument.startsWith(`${name}=`)) {
    const value = argument.slice(name.length + 1);
    if (!value) throw new CliError(`${name} requires a value.`);
    return { value, consumed: 0 };
  }
  return null;
}

function parseOptions(args, { command = 'init' } = {}) {
  const init = command === 'init';
  const options = { yes: false, dryRun: false, tool: 'all', lang: 'vi', recipe: null, help: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--lang' || argument.startsWith('--lang=')) {
      const parsed = parseValue(argument, '--lang', args, index);
      options.lang = parsed.value;
      index += parsed.consumed;
      continue;
    }
    if (init && (argument === '--yes' || argument === '-y')) {
      options.yes = true;
      continue;
    }
    if (init && argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (init && (argument === '--tool' || argument.startsWith('--tool='))) {
      const parsed = parseValue(argument, '--tool', args, index);
      options.tool = parsed.value;
      index += parsed.consumed;
      continue;
    }
    if (init && (argument === '--recipe' || argument.startsWith('--recipe='))) {
      const parsed = parseValue(argument, '--recipe', args, index);
      options.recipe = parsed.value;
      index += parsed.consumed;
      continue;
    }
    throw new CliError(`Unknown option: ${argument}`);
  }
  if (!VALID_LANGS.has(options.lang)) throw new CliError(`--lang must be vi or en (received: ${options.lang}).`);
  if (init && !VALID_TOOLS.has(options.tool)) {
    throw new CliError(`--tool must be claude, codex, cursor or all (received: ${options.tool}).`);
  }
  if (init && options.recipe !== null && !VALID_RECIPES.has(options.recipe)) {
    throw new CliError(`--recipe must be one of: ${RECIPES.map(({ slug }) => slug).join(', ')} (received: ${options.recipe}).`);
  }
  return options;
}

export function parseCli(argv) {
  if (argv.length === 0) return { command: 'help', options: {} };
  if (argv[0] === '--version' || argv[0] === '-v') {
    if (argv.length > 1) throw new CliError(`Unknown option: ${argv[1]}`);
    return { command: 'version', options: {} };
  }
  if (argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    if (argv.length > 1) throw new CliError(`Unknown option: ${argv[1]}`);
    return { command: 'help', options: {} };
  }
  if (['plans', 'invoices', 'deploy'].includes(argv[0])) return { command: argv[0], options: parseCloudOptions(argv[0], argv.slice(1)) };
  if (argv[0] === 'vps') {
    if (argv[1] !== 'create') throw new CliError('Dùng monacloud vps create --plan <code> --monthly.');
    return { command: 'vps', options: parseCloudOptions('vps', argv.slice(2)) };
  }
  if (argv[0] === 'init') return { command: 'init', options: parseOptions(argv.slice(1)) };
  if (argv[0] === 'doctor') return { command: 'doctor', options: parseOptions(argv.slice(1), { command: 'doctor' }) };
  if (argv[0] === 'recipes') return { command: 'recipes', options: parseOptions(argv.slice(1), { command: 'recipes' }) };
  throw new CliError(`Unknown command: ${argv[0]}`);
}

export function formatRecipes(lang = 'vi') {
  if (!VALID_LANGS.has(lang)) throw new CliError(`Invalid --lang value: ${lang}`);
  const groups = lang === 'en'
    ? [
      ['business', 'Business operations'],
      ['sales', 'Marketing & sales'],
      ['owner', 'Owner assistant'],
    ]
    : [
      ['business', 'Quản trị doanh nghiệp'],
      ['sales', 'Marketing & bán hàng'],
      ['owner', 'Trợ lý riêng của chủ'],
    ];
  const lines = [];
  for (const [group, label] of groups) {
    lines.push(`${label}:`);
    for (const recipe of RECIPES.filter((item) => item.group === group)) {
      lines.push(`  ${recipe.slug} — ${recipe[lang]}`);
    }
  }
  return lines.join('\n');
}

function executableCandidates(name, env, cwd) {
  const candidates = [];
  if (env.MONACLOUD_MCP_BIN) candidates.push(resolve(env.MONACLOUD_MCP_BIN));
  candidates.push(resolve(cwd, 'node_modules', '.bin', name));
  const extensions = process.platform === 'win32'
    ? (env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  for (const folder of (env.PATH || '').split(delimiter).filter(Boolean)) {
    for (const extension of extensions) candidates.push(join(folder, `${name}${extension}`));
  }
  return [...new Set(candidates)];
}

export function findExecutable(name, env, cwd) {
  for (const candidate of executableCandidates(name, env, cwd)) {
    try {
      const candidateStat = lstatSync(candidate);
      if (candidateStat.isFile() || candidateStat.isSymbolicLink()) {
        accessSync(candidate, constants.X_OK);
        if (!statSync(candidate).isFile()) continue;
        return candidate;
      }
    } catch {
      // Keep searching PATH.
    }
  }
  return null;
}

function tokenPathFor(env) {
  const fallbackHome = env.HOME || env.USERPROFILE || '';
  const configDir = env.MONACLOUD_CONFIG_DIR
    || env.XDG_CONFIG_HOME && join(env.XDG_CONFIG_HOME, 'monacloud')
    || join(fallbackHome, '.config', 'monacloud');
  return join(configDir, 'token.json');
}

export function runDoctor({
  env = process.env,
  cwd = process.cwd(),
  nodeVersion = process.versions.node,
} = {}) {
  const checks = [];
  const nodeMajor = Number.parseInt(nodeVersion.split('.')[0], 10);
  checks.push({
    id: 'node',
    ok: Number.isInteger(nodeMajor) && nodeMajor >= 20,
    detail: `Node.js ${nodeVersion}${nodeMajor >= 20 ? '' : ' (requires >=20)'}`,
  });

  const executable = findExecutable('monacloud-mcp', env, cwd);
  const npx = executable ? null : findExecutable('npx', env, cwd);
  if (!executable && !npx) {
    checks.push({ id: 'mcp', ok: false, detail: 'monacloud-mcp is not available locally and npx was not found' });
  } else {
    const command = executable || npx;
    const args = executable
      ? ['--version']
      : ['--offline', '--yes', '--package=monacloud-mcp', '--', 'monacloud-mcp', '--version'];
    const result = spawnSync(command, args, {
      cwd,
      env,
      encoding: 'utf8',
      timeout: 10_000,
      windowsHide: true,
    });
    const version = result.status === 0 ? result.stdout.match(/\b\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\b/)?.[0] : '';
    checks.push({
      id: 'mcp',
      ok: result.status === 0,
      detail: result.status === 0
        ? `monacloud-mcp runs${version ? ` (version ${version})` : ''}${executable ? '' : ' from the offline npm cache'}`
        : executable
          ? 'monacloud-mcp was found but did not run successfully'
          : 'monacloud-mcp is not available in the offline npm cache',
    });
  }

  const tokenPath = tokenPathFor(env);
  try {
    const tokenStat = lstatSync(tokenPath);
    const mode = tokenStat.mode & 0o777;
    const regular = tokenStat.isFile() && !tokenStat.isSymbolicLink();
    const secure = regular && mode === 0o600;
    checks.push({
      id: 'token',
      ok: secure,
      detail: secure
        ? `token store exists with mode 0600 (${tokenPath})`
        : `token store must be a regular file with mode 0600 (${tokenPath}; current mode ${mode.toString(8).padStart(4, '0')})`,
    });
  } catch (error) {
    const missing = error && error.code === 'ENOENT';
    checks.push({
      id: 'token',
      ok: false,
      detail: missing
        ? `token store not found (${tokenPath}); run npx -y monacloud-mcp login`
        : `cannot inspect token store metadata (${tokenPath})`,
    });
  }

  return { checks, ok: checks.every((check) => check.ok) };
}

export function helpText(lang = 'vi') {
  if (lang === 'en') {
    return `Usage:
  monacloud init [--yes] [--dry-run] [--tool claude|codex|cursor|all] [--lang vi|en] [--recipe <slug>]
  monacloud recipes [--lang vi|en]
  monacloud doctor [--lang vi|en]
  monacloud plans
  monacloud vps create --plan <code> --monthly [--period month|year] [--name <name>] [--sandbox] [--dry-run] [--yes]
  monacloud invoices [--pdf <id>]
  monacloud deploy [--repo <url>] [--branch <name>] [--build dockerfile|nixpacks|static] [--domain <host>] [--app-host <id>] [--port <port>] [--dockerfile <path>] [--sandbox] [--dry-run] [--yes]
  monacloud --help
  monacloud --version

Commands:
  init     Add MONA Cloud agent instructions, MCP configs and env example
  recipes  List seven recipes in three business groups
  doctor   Check Node.js, monacloud-mcp and token-store permissions`;
  }
  return `Cách dùng:
  monacloud init [--yes] [--dry-run] [--tool claude|codex|cursor|all] [--lang vi|en] [--recipe <slug>]
  monacloud recipes [--lang vi|en]
  monacloud doctor [--lang vi|en]
  monacloud plans
  monacloud vps create --plan <code> --monthly [--period month|year] [--name <name>] [--sandbox] [--dry-run] [--yes]
  monacloud invoices [--pdf <id>]
  monacloud deploy [--repo <url>] [--branch <name>] [--build dockerfile|nixpacks|static] [--domain <host>] [--app-host <id>] [--port <port>] [--dockerfile <path>] [--sandbox] [--dry-run] [--yes]
  monacloud --help
  monacloud --version

Lệnh:
  init     Thêm luật cho AI agent, cấu hình MCP và env mẫu
  recipes  Liệt kê 7 công thức theo 3 nhóm mảng
  doctor   Kiểm tra Node.js, monacloud-mcp và quyền token store`;
}
