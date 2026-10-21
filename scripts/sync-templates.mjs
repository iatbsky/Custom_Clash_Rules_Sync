import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export function customize(text) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const game = 'custom_proxy_group=🎮 游戏加速`select`(V4|V3)';
  const lines = text.split(/\r?\n/).map(line => {
    if (!line.startsWith('custom_proxy_group=')) return line;
    const fields = line.split('`');
    if (fields[0] === 'custom_proxy_group=🎮 游戏加速') return line;
    if (!['select', 'url-test', 'fallback', 'load-balance', 'relay'].includes(fields[1])) return line;
    for (let index = 2; index < fields.length; index++) {
      const selector = fields[index];
      if (/^https?:\/\//.test(selector)) break;
      if (!selector || selector.startsWith('[]')) continue;
      fields[index] = '^(?!.*V[34]).*(?:' + selector + ')';
    }
    return fields.join('`');
  });
  const result = [];
  for (const line of lines) {
    result.push(line);
    if (line.startsWith('custom_proxy_group=🐟 漏网之鱼') && !lines.some(item => item.startsWith('custom_proxy_group=🎮 游戏加速`'))) {
      result.push(game);
    }
  }
  return result.join(newline);
}

export async function syncTemplates(source, target) {
  if (resolve(source) === resolve(target)) throw new Error('Source and target must differ.');
  const entries = await readdir(source, { withFileTypes: true });
  const names = entries.filter(entry => entry.isFile() && entry.name.endsWith('.ini')).map(entry => entry.name).sort();
  if (!names.length) throw new Error('No upstream INI templates found; refusing an empty sync.');
  // Read and validate everything before changing the destination.
  const templates = await Promise.all(names.map(async name => {
    const text = await readFile(join(source, name), 'utf8');
    if (!text.includes('[custom]') || !text.includes('custom_proxy_group=')) {
      throw new Error('Invalid subscription template: ' + name);
    }
    return { name, text };
  }));
  await mkdir(join(target, 'fb'), { recursive: true });
  for (const { name, text } of templates) {
    await writeFile(join(target, name), text, 'utf8');
    await writeFile(join(target, 'fb', name), customize(text), 'utf8');
  }
  return names;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [source = '.upstream/cfg', target = 'cfg'] = process.argv.slice(2);
  const names = await syncTemplates(source, target);
  const commit = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile('sync-source.json', JSON.stringify({
    repository: 'Aethersailor/Custom_OpenClash_Rules',
    branch: 'main',
    commit,
    templates: names
  }, null, 2) + '\n');
  console.log('Synced ' + names.length + ' upstream templates and fb variants from ' + commit);
}
