import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { customize, syncTemplates } from '../scripts/sync-templates.mjs';

const template = '[custom]\ncustom_proxy_group=🇭🇰 香港节点`url-test`(港)\ncustom_proxy_group=🐟 漏网之鱼`select`[]DIRECT\n';

test('fb variants preserve regional matching and append the game group', () => {
  const result = customize(template);
  const selector = result.split('\n')[1].split('`')[2];
  const matches = new RegExp(selector);
  assert.ok(matches.test('香港 普通节点'));
  for (const name of ['香港 V3', 'V3 香港', '香港 V4', 'V4 香港']) {
    assert.equal(matches.test(name), false, name);
  }
  assert.equal(matches.test('美国 普通节点'), false);
  assert.equal(result.split('custom_proxy_group=🎮 游戏加速`select`(V4|V3)').length - 1, 1);
  assert.ok(result.endsWith('\n'));
  assert.equal(customize(template.replaceAll('\n', '\r\n')), result.replaceAll('\n', '\r\n'));
});

test('all direct node selectors exclude V3 and V4 while game selectors keep them', () => {
  const source = [
    '[custom]',
    'custom_proxy_group=🚀 手动选择`select`[]🇭🇰 香港节点`.*',
    'custom_proxy_group=♻️ 自动选择`url-test`.*`https://example.com/check`300,,50',
    'custom_proxy_group=🇭🇰 香港节点`fallback`港|HK`https://example.com/check`300,5',
    'custom_proxy_group=其他地区`select`^(?!.*港).*$',
    'custom_proxy_group=均衡`load-balance`港|HK`https://example.com/check`300,,50',
    'custom_proxy_group=🎯 全球直连`select`[]DIRECT`https://example.com/check',
    'custom_proxy_group=🎮 游戏加速`select`(V4|V3)',
  ].join('\n');
  const groups = customize(source).split('\n').slice(1);
  for (const line of groups.slice(0, 5)) {
    const selectors = line.split('`').slice(2).filter(field => !field.startsWith('[]'));
    const pattern = new RegExp(selectors[0]);
    for (const name of ['港 V3', 'HK V4', 'V3 港', 'V4 HK', '美国 V3', '美国 V4']) {
      assert.equal(pattern.test(name), false, line + ': ' + name);
    }
    assert.ok(pattern.test(line.includes('其他地区') ? '美国 普通节点' : 'HK 港 普通节点'));
  }
  assert.equal(groups[5], source.split('\n')[6]);
  const game = new RegExp(groups[6].split('`')[2]);
  assert.ok(game.test('香港 V3'));
  assert.ok(game.test('香港 V4'));
  assert.equal(game.test('香港 普通节点'), false);
  assert.ok(groups[1].endsWith('`https://example.com/check`300,,50'));
});

test('sync is repeatable, reads only top-level INI files and preserves local files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'clash-sync-'));
  try {
    const source = join(root, 'upstream');
    const target = join(root, 'cfg');
    await mkdir(source);
    await mkdir(target);
    await mkdir(join(source, 'archived'));
    await writeFile(join(source, 'Custom_Clash.ini'), template);
    await writeFile(join(source, 'README.md'), 'Ignore me');
    await writeFile(join(source, 'archived', 'old.ini'), template);
    await writeFile(join(target, 'local.ini'), 'Preserve me');
    assert.deepEqual(await syncTemplates(source, target), ['Custom_Clash.ini']);
    const first = await readFile(join(target, 'fb', 'Custom_Clash.ini'), 'utf8');
    await syncTemplates(source, target);
    assert.equal(await readFile(join(target, 'fb', 'Custom_Clash.ini'), 'utf8'), first);
    assert.equal(await readFile(join(target, 'Custom_Clash.ini'), 'utf8'), template);
    assert.equal(await readFile(join(target, 'local.ini'), 'utf8'), 'Preserve me');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('invalid or empty upstream does not replace existing templates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'clash-sync-'));
  try {
    const source = join(root, 'upstream');
    const target = join(root, 'cfg');
    await mkdir(source);
    await mkdir(target);
    await writeFile(join(target, 'Custom_Clash.ini'), template);
    await assert.rejects(syncTemplates(source, target), /No upstream INI/);
    await writeFile(join(source, 'Custom_Clash.ini'), 'invalid');
    await assert.rejects(syncTemplates(source, target), /Invalid subscription template/);
    assert.equal(await readFile(join(target, 'Custom_Clash.ini'), 'utf8'), template);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
