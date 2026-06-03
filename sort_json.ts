import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

function sortObjectKeys(obj: any): any {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return obj;
  }
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: any = {};
  for (const key of sortedKeys) {
    sortedObj[key] = sortObjectKeys(obj[key]);
  }
  return sortedObj;
}

function buildLibraryFile(name: string, description: string, version: string, varName: string, data: any): string {
  const lines = JSON.stringify(data, null, 2).split("\n");
  const dataStr = [`var ${varName} = {`, ...lines.slice(1, -1), `};`].join("\n");
  return `// ==UserScript==
// @name         ${name}
// @namespace    https://github.com/jyking/claude2cn/
// @homepageURL  https://github.com/jyking/claude2cn/
// @author       jyking
// @version      ${version}
// @description  ${description}
// @license      MIT
// ==/UserScript==
${dataStr}
`;
}

const currentDir = "./";
const mainPath = join(currentDir, "claude2cn.user.js");
const transOutputPath = join(currentDir, "claude2cn-translations.user.js");
const designOutputPath = join(currentDir, "claude2cn-design.user.js");

// 读取并排序 JSON 数据
console.log("正在读取 en2cn.json...");
const en2cnData = sortObjectKeys(JSON.parse(readFileSync(join(currentDir, "en2cn.json"), "utf8")));
writeFileSync(join(currentDir, "en2cn.json"), JSON.stringify(en2cnData, null, 2), "utf8");
console.log("✅ en2cn.json 排序完成");

console.log("正在读取 design.json...");
const designData = sortObjectKeys(JSON.parse(readFileSync(join(currentDir, "design.json"), "utf8")));
writeFileSync(join(currentDir, "design.json"), JSON.stringify(designData, null, 2), "utf8");
console.log("✅ design.json 排序完成");

// 从 user.js 提取版本号
const mainContent = readFileSync(mainPath, "utf8");
const versionMatch = mainContent.match(/@version\s+([\d.\w-]+)/);
if (!versionMatch) {
  console.error("错误：找不到 @version");
  process.exit(1);
}
const version = versionMatch[1];
console.log(`\n版本号: ${version}`);

// 生成词库文件
console.log("\n正在生成词库文件...");
writeFileSync(
  transOutputPath,
  buildLibraryFile("Claude 中文汉化 - 中文词库规则", "Claude 中文汉化词库规则，配合主插件使用", version, "TRANSLATIONS", en2cnData),
  "utf8",
);
console.log("✅ claude2cn-translations.user.js");

writeFileSync(
  designOutputPath,
  buildLibraryFile("Claude 中文汉化 - Design 词库规则", "Claude 中文汉化 Design 页面词库规则，配合主插件使用", version, "DESIGN_TRANSLATIONS", designData),
  "utf8",
);
console.log("✅ claude2cn-design.user.js");

// 同步 user.js 中 @require 的版本号
const updatedMain = mainContent.replace(
  /(@require\s+https:\/\/raw\.githubusercontent\.com\/jyking\/claude2cn\/main\/[^\s?]+)(\?v[\d.\w-]+)?/g,
  `$1?v${version}`,
);
if (updatedMain !== mainContent) {
  writeFileSync(mainPath, updatedMain, "utf8");
  console.log(`\n✅ claude2cn.user.js 中 @require 版本已同步为 v${version}`);
}
