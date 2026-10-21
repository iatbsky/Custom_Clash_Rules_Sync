import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { customize, syncTemplates } from '../scripts/sync-templates.mjs';

const template = '[custom]\ncustom_proxy_group=🇭🇰 香港节点`url-test`(港)\ncustom_proxy_group=🐟 漏网之鱼`select`[]DIRECT\n';

test('fb variants preserve regional matching and append the game group', () => {
  const result = customize(template);
  assert.ok(result.includes('节点`url-test`(^(?!.*V4).*)(港)'));
  assert.equal(result.split('custom_proxy_group=🎮 游戏加速`select`(V4|V3)').length - 1, 1);
  assert.ok(result.endsWith('\n'));
  assert.equal(customize(template.replaceAll('\n', '\r\n')), result.replaceAll('\n', '\r\n'));
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
