import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { customize, syncTemplates } from '../scripts/sync-templates.mjs';
import { buildClientTemplate, clientBase } from '../scripts/client-templates.mjs';

const template = '[custom]\ncustom_proxy_group=🇭🇰 香港节点`url-test`(港)\ncustom_proxy_group=🐟 漏网之鱼`select`[]DIRECT\ncustom_proxy_group=🚀 手动选择`select`.*\ncustom_proxy_group=♻️ 自动选择`url-test`.*`https://example.com/check`300,,50\ncustom_proxy_group=🎯 全球直连`select`[]DIRECT\n';

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
    assert.equal(await readFile(join(target, 'fb', 'FlClash.ini'), 'utf8'), customize(buildClientTemplate(template, 'FlClash')));
    assert.equal(await readFile(join(target, 'fb', 'Clash_Verge_Rev.ini'), 'utf8'), customize(buildClientTemplate(template, 'Clash_Verge_Rev')));
    assert.equal(await readFile(join(target, 'fb', 'base.yaml'), 'utf8'), clientBase);
    await assert.rejects(readFile(join(target, 'clients', 'FlClash.ini')), { code: 'ENOENT' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('mobile and desktop keep rule ordering without the nonstandard port override', () => {
  const rules = [
    'ruleset=🎯 全球直连,[]GEOSITE,private',
    'ruleset=📹 YouTube,[]GEOSITE,youtube',
    'ruleset=🤖 ChatGPT,[]GEOSITE,openai',
    'ruleset=Ⓜ️ 微软服务,[]GEOSITE,microsoft',
    'ruleset=🔀 非标端口,clash-classic:https://example.com/ports.yaml,28800',
    'ruleset=🐟 漏网之鱼,[]FINAL',
  ];
  const source = template + rules.join('\n') + '\n';
  for (const client of ['FlClash', 'Clash_Verge_Rev']) {
    const output = customize(buildClientTemplate(source, client));
    assert.ok(!output.includes('🔀 非标端口'));
    assert.ok(output.includes('clash_rule_base=https://raw.githubusercontent.com/iatbsky/Custom_Clash_Rules_Sync/main/cfg/fb/base.yaml'));
    const actual = output.split('\n').filter(line => line.startsWith('ruleset='));
    assert.deepEqual(actual.map(line => line.slice(line.indexOf(','))), rules.filter(line => !line.includes('非标端口')).map(line => line.slice(line.indexOf(','))));
    const game = output.split('\n').find(line => line.startsWith('custom_proxy_group=🎮 游戏加速'));
    assert.ok(game.endsWith('`(V4|V3)`[]🚀 手动选择'));
    const groups = output.split('\n').filter(line => line.startsWith('custom_proxy_group='));
    assert.equal(new Set(groups.map(line => line.split('`')[0])).size, groups.length);
    if (client === 'FlClash') {
      assert.equal(groups.filter(line => line.includes('`url-test`')).length, 1);
      assert.ok(groups.find(line => line.includes('`url-test`')).endsWith('`1800,,100'));
      assert.ok(output.includes('ruleset=🎬 流媒体,[]GEOSITE,youtube'));
      assert.ok(output.includes('ruleset=🤖 AI服务,[]GEOSITE,openai'));
      assert.ok(output.includes('custom_proxy_group=🇭🇰 香港节点`select`'));
    } else {
      assert.ok(output.includes('ruleset=📹 YouTube,[]GEOSITE,youtube'));
      assert.ok(output.includes('custom_proxy_group=🇭🇰 香港节点`url-test`'));
    }
  }
});

test('missing required upstream groups fail before replacing output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'clash-sync-'));
  try {
    const source = join(root, 'upstream');
    const target = join(root, 'cfg');
    await mkdir(source);
    await mkdir(target);
    await writeFile(join(source, 'Custom_Clash.ini'), '[custom]\ncustom_proxy_group=Only`select`.*\n');
    await writeFile(join(target, 'Custom_Clash.ini'), 'preserve');
    await assert.rejects(syncTemplates(source, target), /Required upstream group missing/);
    assert.equal(await readFile(join(target, 'Custom_Clash.ini'), 'utf8'), 'preserve');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('actual client templates have valid policies and isolated game nodes', async () => {
  const upstream = await readFile(new URL('../cfg/Custom_Clash.ini', import.meta.url), 'utf8');
  for (const client of ['FlClash', 'Clash_Verge_Rev']) {
    const text = customize(buildClientTemplate(upstream, client));
    assert.ok(!text.includes('jsdelivr.net'));
    const lines = text.split('\n');
    const groups = lines.filter(line => line.startsWith('custom_proxy_group=')).map(line => line.split('`'));
    const policies = new Set(['DIRECT', 'REJECT', ...groups.map(fields => fields[0].slice('custom_proxy_group='.length))]);
    assert.equal(policies.size, groups.length + 2);
    for (const line of lines.filter(line => line.startsWith('ruleset='))) {
      assert.ok(policies.has(line.slice('ruleset='.length, line.indexOf(','))), line);
    }
    for (const fields of groups) {
      for (const field of fields.slice(2)) {
        if (/^https?:\/\//.test(field)) break;
        if (field.startsWith('[]')) {
          assert.ok(policies.has(field.slice(2)), field);
        } else {
          const regex = new RegExp(field);
          if (fields[0] === 'custom_proxy_group=🎮 游戏加速') {
            assert.ok(regex.test('香港 HK V3'));
            assert.ok(regex.test('香港 HK V4'));
          } else {
            for (const name of ['香港 HK V3', '美国 US V4', 'V3 日本 JP', 'V4 台湾 TW']) {
              assert.equal(regex.test(name), false, fields[0]);
            }
          }
        }
      }
    }
    if (client === 'Clash_Verge_Rev') {
      const steam = groups.find(fields => fields[0] === 'custom_proxy_group=🎮 Steam');
      assert.equal(steam[2], '[]🎯 全球直连');
      assert.ok(steam.includes('[]🎮 游戏加速'));
    }
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
