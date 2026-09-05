#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import {
  CliError,
  REGISTRATION_URL,
  VERSION,
  applyInitPlan,
  buildInitPlan,
  formatDiff,
  formatRecipes,
  helpText,
  parseCli,
  runDoctor,
} from './core.js';

async function confirmInit(lang) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(lang === 'en'
      ? 'Interactive confirmation needs a terminal. Re-run with --yes.'
      : 'Cần terminal để xác nhận. Chạy lại với --yes.', 1);
  }
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await readline.question(lang === 'en'
      ? 'Add MONA Cloud files to this project? [y/N] '
      : 'Thêm cấu hình MONA Cloud vào dự án này? [y/N] ');
    return /^(y|yes|c|co|có)$/iu.test(answer.trim());
  } finally {
    readline.close();
  }
}

function printNextSteps(lang, tool) {
  if (tool === 'all' || tool === 'codex') {
    console.log(`Codex MCP: codex mcp add monacloud -- npx -y monacloud-mcp`);
  }
  if (lang === 'en') {
    console.log('Next steps:');
    console.log(`1. Register a MONA Pass: ${REGISTRATION_URL}`);
    console.log('2. Sign in: npx -y monacloud-mcp login');
    console.log('3. Paste this prompt: "Build a sales app on MONA Cloud"');
    return;
  }
  console.log('Tiếp theo:');
  console.log(`1. Đăng ký MONA Pass: ${REGISTRATION_URL}`);
  console.log('2. Đăng nhập: npx -y monacloud-mcp login');
  console.log('3. Dán prompt: "Dựng app bán hàng trên MONA Cloud"');
}

async function init(options) {
  if (options.help) {
    console.log(helpText(options.lang));
    return;
  }

  const plan = buildInitPlan({
    cwd: process.cwd(),
    tool: options.tool,
    lang: options.lang,
    recipe: options.recipe,
  });
  const changedPlan = plan.filter((item) => item.changed);

  if (options.dryRun) {
    if (changedPlan.length === 0) {
      console.log(options.lang === 'en' ? 'No changes.' : 'Không có thay đổi.');
    } else {
      console.log(changedPlan.map(formatDiff).join('\n'));
    }
    printNextSteps(options.lang, options.tool);
    return;
  }

  if (!options.yes && !await confirmInit(options.lang)) {
    console.log(options.lang === 'en' ? 'Cancelled.' : 'Đã huỷ.');
    return;
  }

  const changed = applyInitPlan(plan);
  if (options.lang === 'en') {
    console.log(`MONA Cloud initialized: ${changed.length} file(s) changed.`);
  } else {
    console.log(`Đã khởi tạo MONA Cloud: ${changed.length} file thay đổi.`);
  }
  for (const item of changed) console.log(`${item.before === null ? '+' : '~'} ${item.relativePath}`);
  printNextSteps(options.lang, options.tool);
}

function doctor(options) {
  if (options.help) {
    console.log(helpText(options.lang));
    return;
  }
  const result = runDoctor();
  console.log(options.lang === 'en' ? 'MONA Cloud doctor' : 'Kiểm tra MONA Cloud');
  for (const check of result.checks) console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.detail}`);
  if (!result.ok) process.exitCode = 1;
}

async function main() {
  const parsed = parseCli(process.argv.slice(2));
  if (parsed.command === 'version') {
    console.log(VERSION);
    return;
  }
  if (parsed.command === 'help') {
    console.log(helpText());
    return;
  }
  if (parsed.command === 'doctor') {
    doctor(parsed.options);
    return;
  }
  if (parsed.command === 'recipes') {
    if (parsed.options.help) {
      console.log(helpText(parsed.options.lang));
    } else {
      console.log(formatRecipes(parsed.options.lang));
    }
    return;
  }
  await init(parsed.options);
}

main().catch((error) => {
  const exitCode = error instanceof CliError ? error.exitCode : 1;
  console.error(`monacloud: ${error.message}`);
  process.exitCode = exitCode;
});
