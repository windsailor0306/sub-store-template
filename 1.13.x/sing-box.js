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
// 键是分组 tag，值是一个正则，匹配到就排除
const excludeRules = {
  '香港': /自建|测试/i,          // 香港分组排除自建和测试
  '台湾': /自建|测试/i,          // 台湾分组排除自建和测试
  '日本': /自建|测试/i,          // 日本分组排除自建和测试
  '新加坡': /自建|测试/i,        // 新加坡排除自建和测试
  '美国': /自建|测试/i,          // 美国排除自建和测试
  '其他地区': /自建|测试/i       // 其他地区排除自建和测试
  // 你可以在这里添加更多自定义规则，例如排除特定运营商
};

// ===== 主逻辑 =====
config.outbounds.forEach(i => {
  let matchedTags = [];

  // 手动选择/自动选择保持全部节点
  if (['手动选择', '自动选择'].includes(i.tag)) {
    matchedTags.push(...getTags(proxies));
  }

  // 国家分组/其他地区
  const countryRegexMap = {
    '香港': /港|hk|hongkong|hong kong|🇭🇰/i,
    '台湾': /台|tw|taiwan|🇹🇼/i,
    '日本': /日本|jp|japan|🇯🇵/i,
    '新加坡': /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i,
    '美国': /美|us|unitedstates|united states|🇺🇸/i
  };

  if (countryRegexMap[i.tag]) {
    let nodes = getTags(proxies, countryRegexMap[i.tag]);
    if (excludeRules[i.tag]) {
      nodes = nodes.filter(tag => !excludeRules[i.tag].test(tag));
    }
    matchedTags.push(...nodes);
  }

  // 其他地区
  if (['其他地区'].includes(i.tag)) {
    let nodes = getOtherTags(proxies);
    if (excludeRules[i.tag]) {
      nodes = nodes.filter(tag => !excludeRules[i.tag].test(tag));
    }
    matchedTags.push(...nodes);
  }

  // 自建分组：保留自建节点
  if (['自建'].includes(i.tag)) {
    matchedTags.push(...getTags(proxies, /自建/i));
  }

  // 测试节点分组：保留测试节点
  if (['测试节点'].includes(i.tag)) {
    matchedTags.push(...getTags(proxies, /测试|自建/i));
  }

  // ✅ 非空才创建 outbounds，并去重
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