import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { RECIPES } from '../bin/core.js';

const templates = new URL('../templates/', import.meta.url);

test('every finalized recipe ships Vietnamese and English instructions', () => {
  assert.equal(RECIPES.length, 7);
  for (const { slug } of RECIPES) {
    for (const lang of ['vi', 'en']) {
      const content = readFileSync(new URL(`recipes/${slug}.${lang}.md`, templates), 'utf8');
      assert.match(content, /cloud_balance/);
      if (slug === 'gui-mail-otp') assert.match(content, /mail_send/);
      else assert.match(content, /cloud_vps_create/);
      assert.doesNotMatch(content, /vibecloud_|VibeCloud/);
      assert.match(content, /## (Mục tiêu|Goal)/);
      assert.match(content, /## (Người dùng cần làm|What the user must do)/);
      assert.match(content, /## (Điểm phải dừng hỏi người dùng|Stop and ask)/);
      assert.match(content, /## (Tiêu chí hoàn thành|Done when)/);
    }
  }
});

test('shipped prose passes recipe voice and status gates', () => {
  const files = [
    'agent.vi.md',
    'agent.en.md',
    ...RECIPES.flatMap(({ slug }) => [`recipes/${slug}.vi.md`, `recipes/${slug}.en.md`]),
  ];
  const prose = files.map((file) => readFileSync(new URL(file, templates), 'utf8')).join('\n');

  assert.doesNotMatch(prose, /(^|\s)(?:ạ|Vâng)(?=\s|[.,!?;:]|$)/u);
  assert.doesNotMatch(prose, /\d[\d.,+]*\s+(?:nhân sự|khách hàng|employees?|customers?)/iu);
  for (const product of ['MONA Base', 'MONA AI', 'MONA Mail', 'MONA Agent']) {
    assert.match(prose, new RegExp(`${product} chưa mở — dùng cách tạm:`));
    assert.match(prose, new RegExp(`${product} is not available yet — workaround:`));
  }
});
