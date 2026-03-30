import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * 将 JSON 对象的键按字母顺序排列
 */
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

const currentDir = "./";
const jsonFile = "en2cn.json";
const templateFile = "claude2cn.user-temp.js";
const outputFile = "claude2cn.user.js";

const jsonPath = join(currentDir, jsonFile);
const templatePath = join(currentDir, templateFile);
const outputPath = join(currentDir, outputFile);

// 第一步：读取并排序 en2cn.json
console.log(`正在读取: ${jsonPath}`);
const rawData = readFileSync(jsonPath, "utf8");
const data = JSON.parse(rawData);

console.log("正在排序键...");
const sortedData = sortObjectKeys(data);

console.log(`正在写入排序后的 JSON...`);
writeFileSync(jsonPath, JSON.stringify(sortedData, null, 2), "utf8");
console.log("✅ JSON 排序完成");

// 第二步：读取模板，将 TRANSLATIONS 占位符替换为实际内容，输出到 claude2cn.user.js
console.log(`\n正在读取模板: ${templatePath}`);
const template = readFileSync(templatePath, "utf8");

// 将 JSON 内容格式化为 JS 对象字面量（2格缩进），与模板风格匹配
const jsonLines = JSON.stringify(sortedData, null, 2).split("\n");
// 第一行: "const TRANSLATIONS = {"，最后一行: "};"，中间行增加2格缩进
const translationsBlock = [
  "  const TRANSLATIONS = {",
  ...jsonLines.slice(1, -1).map((line) => "  " + line),
  "  };",
].join("\n");

// 替换模板中的 `  const TRANSLATIONS = {};`
const placeholder = "  const TRANSLATIONS = {};";
if (!template.includes(placeholder)) {
  console.error(`错误：在模板中找不到占位符: "${placeholder}"`);
  process.exit(1);
}

const output = template.replace(placeholder, translationsBlock);

console.log(`正在写入: ${outputPath}`);
writeFileSync(outputPath, output, "utf8");

console.log(`\n✅ 完成！已生成 ${outputFile}`);
