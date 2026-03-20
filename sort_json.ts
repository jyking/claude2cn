import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * 将 JSON 对象的键按字母顺序排列
 * @param obj 原始对象
 * @returns 排序后的新对象
 */
function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: any = {};

  for (const key of sortedKeys) {
    // 递归处理嵌套对象（如果以后有的话）
    sortedObj[key] = sortObjectKeys(obj[key]);
  }

  return sortedObj;
}

const targetFile = "en2cn.json";
const currentDir = "/Users/jyking/nextcloud/project/temp-my/claude.ai/i18n/fen/";
const absolutePath = join(currentDir, targetFile);

try {
  console.log(`正在读取文件: ${absolutePath}`);
  const rawData = readFileSync(absolutePath, "utf8");
  const data = JSON.parse(rawData);

  console.log("正在对键进行排序...");
  const sortedData = sortObjectKeys(data);

  console.log(`正在写入文件...`);
  writeFileSync(absolutePath, JSON.stringify(sortedData, null, 2), "utf8");

  console.log("排序完成！键已按顺序排列。");
} catch (error) {
  console.error("发生错误:", error);
}
