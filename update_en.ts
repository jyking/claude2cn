import fs from 'fs';

async function updateEn2Cn() {
  const enPath = './en.json';
  const localPath = './en2cn.json';

  console.log('📂 正在读取本地文件 en.json...');
  if (!fs.existsSync(enPath)) {
    console.error('❌ 错误: en.json 文件不存在，请先将远程文件放到 en.json');
    return;
  }
  let remoteData;
  try {
    const rawContent = fs.readFileSync(enPath, 'utf-8');
    remoteData = JSON.parse(rawContent);
    console.log('✅ en.json 读取并解析成功');
  } catch (error) {
    console.error('❌ 解析 en.json 失败:', error);
    return;
  }

  console.log('📂 正在读取本地文件 en2cn.json...');
  if (!fs.existsSync(localPath)) {
    console.error('❌ 错误: 本地文件 en2cn.json 不存在');
    return;
  }
  const localContent = fs.readFileSync(localPath, 'utf-8');
  let localData = JSON.parse(localContent);

  // 提取 en.json 中的所有字符串值
  const remoteValues = new Set<string>();
  function extractValues(obj: any) {
    if (typeof obj === 'string') {
      remoteValues.add(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        extractValues(obj[key]);
      }
    }
  }

  extractValues(remoteData);
  console.log(`🔍 en.json 中共提取到 ${remoteValues.size} 个唯一值。`);

  let addedCount = 0;
  for (const value of remoteValues) {
    if (!(value in localData)) {
      localData[value] = ''; // 缺失则加入，翻译为空字符串
      addedCount++;
    }
  }

  if (addedCount > 0) {
    console.log(`🚀 共发现 ${addedCount} 个本地不存在的项，正在更新 en2cn.json...`);
    fs.writeFileSync(localPath, JSON.stringify(localData, null, 2), 'utf-8');
    console.log('✨ 更新完成！');
  } else {
    console.log('🎉 没有任何项需要更新，en2cn.json 已是最新。');
  }
}

updateEn2Cn();
