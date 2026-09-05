import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CliError,
  RECIPES,
  formatRecipes,
  mergeManagedBlock,
  parseCli,
} from '../bin/core.js';

test('mergeManagedBlock updates a managed block without touching surrounding text', () => {
  const current = 'before\n<!-- monacloud:start -->\nold\n<!-- monacloud:end -->\nafter\n';
  assert.equal(
    mergeManagedBlock(current, 'new'),
    'before\n<!-- monacloud:start -->\nnew\n<!-- monacloud:end -->\nafter\n',
  );
});

test('mergeManagedBlock rejects partial or duplicate markers', () => {
  assert.throws(() => mergeManagedBlock('<!-- monacloud:start -->\nmissing end', 'new'), CliError);
  assert.throws(() => mergeManagedBlock(
    '<!-- monacloud:start --><!-- monacloud:end --><!-- monacloud:start --><!-- monacloud:end -->',
    'new',
  ), CliError);
});

test('parseCli accepts both separated and equals option forms', () => {
  assert.deepEqual(parseCli(['init', '--tool=cursor', '--lang', 'en', '-y']), {
    command: 'init',
    options: { yes: true, dryRun: false, tool: 'cursor', lang: 'en', recipe: null, help: false },
  });
});

test('parseCli accepts recipe and recipes command forms', () => {
  assert.equal(parseCli(['init', '--recipe=tro-ly-chu-ca', '--yes']).options.recipe, 'tro-ly-chu-ca');
  assert.deepEqual(parseCli(['recipes', '--lang=en']), {
    command: 'recipes',
    options: { yes: false, dryRun: false, tool: 'all', lang: 'en', recipe: null, help: false },
  });
});

test('parseCli rejects unsupported values', () => {
  assert.throws(() => parseCli(['init', '--tool', 'windsurf']), /--tool must be/);
  assert.throws(() => parseCli(['init', '--lang=fr']), /--lang must be/);
  assert.throws(() => parseCli(['init', '--recipe', 'saas-thu-phi']), (error) => (
    error instanceof CliError
    && RECIPES.every(({ slug }) => error.message.includes(slug))
    && !error.message.includes('undefined')
  ));
});

test('formatRecipes lists seven recipes under the three finalized groups', () => {
  const output = formatRecipes('vi');
  assert.match(output, /^Quản trị doanh nghiệp:/m);
  assert.match(output, /^Marketing & bán hàng:/m);
  assert.match(output, /^Trợ lý riêng của chủ:/m);
  assert.equal(output.split('\n').filter((line) => /^  \S+ — /.test(line)).length, 7);
  for (const { slug } of RECIPES) assert.equal(output.split(slug).length - 1, 1);
  assert.doesNotMatch(output, /saas-thu-phi/);
});
