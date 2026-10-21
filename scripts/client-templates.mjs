const rawRoot = 'https://raw.githubusercontent.com/iatbsky/Custom_Clash_Rules_Sync/main/cfg/clients';

export const clientBase = `allow-lan: false
mode: rule
log-level: warning
profile:
  store-selected: true
  store-fake-ip: true
dns:
  enable: true
  enhanced-mode: fake-ip
  fake-ip-range: 198.18.0.1/16
  fake-ip-filter:
    - '*.lan'
    - '*.local'
    - localhost
  default-nameserver:
    - 223.5.5.5
    - 119.29.29.29
  proxy-server-nameserver:
    - 'https://dns.alidns.com/dns-query#DIRECT'
  direct-nameserver:
    - 'https://dns.alidns.com/dns-query#DIRECT'
  nameserver:
    - 'https://1.1.1.1/dns-query#🚀 手动选择'
  nameserver-policy:
    'geosite:cn':
      - 'https://dns.alidns.com/dns-query#DIRECT'
    'geosite:private':
      - system
`;

const mobileTargets = new Map([
  ['💬 即时通讯', '💬 即时通讯'], ['🌐 社交媒体', '💬 即时通讯'],
  ['🤖 ChatGPT', '🤖 AI服务'], ['🤖 AI服务', '🤖 AI服务'],
  ['📹 YouTube', '🎬 流媒体'], ['🎥 AppleTV+', '🎬 流媒体'],
  ['🎶 TikTok', '🎬 流媒体'], ['🎥 Netflix', '🎬 流媒体'],
  ['🎥 DisneyPlus', '🎬 流媒体'], ['🎥 HBO', '🎬 流媒体'],
  ['🎥 PrimeVideo', '🎬 流媒体'], ['🎥 Emby', '🎬 流媒体'],
  ['🎻 Spotify', '🎬 流媒体'], ['📺 Bahamut', '🎬 流媒体'],
  ['🌎 国外媒体', '🎬 流媒体'], ['🍎 苹果服务', '🍎 苹果服务'],
  ['📢 谷歌FCM', '🇬 谷歌服务'], ['🇬 谷歌服务', '🇬 谷歌服务'],
  ['Ⓜ️ 微软服务', '🎯 全球直连'],
  ['🎮 Steam', '🎮 游戏加速'], ['🎮 游戏平台', '🎮 游戏加速'],
]);

export function buildClientTemplate(upstream, client) {
  if (!['FlClash', 'Clash_Verge_Rev'].includes(client)) throw new Error('Unknown client: ' + client);
  const mobile = client === 'FlClash';
  const lines = upstream.split(/\r?\n/);
  const groups = lines.filter(line => line.startsWith('custom_proxy_group='));
  const byName = new Map(groups.map(line => [line.split('`')[0].slice('custom_proxy_group='.length), line]));
  for (const name of ['🚀 手动选择', '♻️ 自动选择', '🐟 漏网之鱼', '🎯 全球直连']) {
    if (!byName.has(name)) throw new Error('Required upstream group missing: ' + name);
  }
  const rules = lines.filter(line => line.startsWith('ruleset=')).map(line =>
    line.replace(/https:\/\/(?:cdn|testingcf)\.jsdelivr\.net\/gh\/Aethersailor\/Custom_OpenClash_Rules@main\//g,
      'https://raw.githubusercontent.com/Aethersailor/Custom_OpenClash_Rules/main/'),
  ).flatMap(line => {
    const comma = line.indexOf(',');
    const target = line.slice('ruleset='.length, comma);
    if (target === '🔀 非标端口') return [];
    if (!mobile) return [line];
    const mapped = ['🎯 全球直连', '🐟 漏网之鱼'].includes(target)
      ? target : mobileTargets.get(target) || '🚀 手动选择';
    return ['ruleset=' + mapped + line.slice(comma)];
  });
  let selected;
  if (mobile) {
    // Regions are manual groups. Only the global group performs scheduled tests.
    const regions = groups.filter(line => /节点$/.test(line.split('`')[0]));
    const regionRefs = regions.map(line => '[]' + line.split('`')[0].slice('custom_proxy_group='.length));
    const choices = ['[]🚀 手动选择', '[]♻️ 自动选择', ...regionRefs];
    selected = [
      ['custom_proxy_group=🚀 手动选择', 'select', '[]♻️ 自动选择', ...regionRefs, '.*'].join('`'),
      ['custom_proxy_group=♻️ 自动选择', 'url-test', '.*', 'https://www.gstatic.com/generate_204', '1800,,100'].join('`'),
      ...['💬 即时通讯', '🤖 AI服务', '🎬 流媒体', '🇬 谷歌服务'].map(name =>
        ['custom_proxy_group=' + name, 'select', ...choices].join('`')),
      ['custom_proxy_group=🍎 苹果服务', 'select', '[]🎯 全球直连', ...choices].join('`'),
      ['custom_proxy_group=🐟 漏网之鱼', 'select', ...choices, '[]🎯 全球直连'].join('`'),
      ...regions.map(line => {
        const fields = line.split('`');
        const url = fields.findIndex((field, index) => index > 1 && /^https?:\/\//.test(field));
        return [fields[0], 'select', ...fields.slice(2, url < 0 ? undefined : url)].join('`');
      }),
      'custom_proxy_group=🎯 全球直连`select`[]DIRECT',
    ];
  } else {
    selected = groups.filter(line => !line.startsWith('custom_proxy_group=🔀 非标端口')).map(line => {
      const fields = line.split('`');
      if (['custom_proxy_group=🎮 Steam', 'custom_proxy_group=🎮 游戏平台'].includes(fields[0])) {
        fields.splice(3, 0, '[]🎮 游戏加速');
      }
      return fields.join('`');
    });
  }
  // Keep the dedicated nodes accessible, with ordinary nodes as an empty-group fallback.
  selected.push('custom_proxy_group=🎮 游戏加速`select`(V4|V3)`[]🚀 手动选择');
  return [
    ';' + client,
    '[custom]',
    'clash_rule_base=' + rawRoot + '/base.yaml',
    ...rules, '', ...selected, '',
    'enable_rule_generator=true', 'overwrite_original_rules=true', '',
  ].join('\n');
}
