const { type, name } = $arguments;

let config = JSON.parse($files[0]);

let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
});

// 把节点暂时加入 config，方便匹配
config.outbounds.push(...proxies);

// ===== 配置每个分组的排除规则 =====
// 只要在这里定义的正则，匹配到的节点都会被剔除
const excludeRules = {
  'default': /自建|测试/i, // 默认排除规则
  '自建': null,           // 明确不执行排除
  '测试节点': null        // 明确不执行排除
};

// 国家/区域匹配正则
const countryRegexMap = {
  '香港': /港|hk|hongkong|hong kong|🇭🇰/i,
  '台湾': /台|tw|taiwan|🇹🇼/i,
  '日本': /日本|jp|japan|🇯🇵/i,
  '新加坡': /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i,
  '美国': /美|us|unitedstates|united states|🇺🇸/i,
  '自动选择': /港|hk|hongkong|hong kong|🇭🇰|台|tw|taiwan|🇹🇼|日本|jp|japan|🇯🇵|新|sg|singapore|🇸🇬|美|us|unitedstates|united states|🇺🇸/i
};

// ===== 主逻辑 =====
config.outbounds.forEach(i => {
  let matchedTags = [];
  const tag = i.tag;

  // 1. 匹配逻辑：决定哪些节点“候选”进入该组
  if (tag === '手动选择') {
    // 手动选择获取所有节点
    matchedTags = getTags(proxies);
  } else if (countryRegexMap[tag]) {
    // 命中具体国家或“自动选择”
    matchedTags = getTags(proxies, countryRegexMap[tag]);
  } else if (tag === '其他地区') {
    matchedTags = getOtherTags(proxies);
  } else if (tag === '自建') {
    matchedTags = getTags(proxies, /自建/i);
  } else if (tag === '测试节点') {
    matchedTags = getTags(proxies, /测试|自建/i);
  }

  // 2. 排除逻辑：统一处理不需要的节点
  // 如果 excludeRules 没定义该 tag，则使用 default 规则
  const rule = excludeRules[tag] !== undefined ? excludeRules[tag] : excludeRules['default'];

  if (rule && matchedTags.length > 0) {
    matchedTags = matchedTags.filter(nodeTag => !rule.test(nodeTag));
  }

  // 3. 赋值并去重
  if (matchedTags.length > 0) {
    i.outbounds = [...new Set(matchedTags)];
  }
});

$content = JSON.stringify(config, null, 2);

// ===== 工具函数 =====
function getTags(proxies, regex) {
  return (regex
    ? proxies.filter(p => p.tag && regex.test(p.tag))
    : proxies.filter(p => p.tag)
  ).map(p => p.tag);
}

function getOtherTags(proxies) {
  // 排除已知国家
  const excludeRegex = /港|hk|hongkong|hong kong|🇭🇰|台|tw|taiwan|🇹🇼|日本|jp|japan|🇯🇵|新|sg|singapore|🇸🇬|美|us|unitedstates|united states|🇺🇸/i;

  return proxies
    .filter(p => p.tag && !excludeRegex.test(p.tag))
    .map(p => p.tag);
}