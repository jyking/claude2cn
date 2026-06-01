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

function buildBlock(varName: string, data: any): string {
  const lines = JSON.stringify(data, null, 2).split("\n");
  return [
    `  const ${varName} = {`,
    ...lines.slice(1, -1).map((line) => "  " + line),
    `  };`,
  ].join("\n");
}

const currentDir = "./";
const templatePath = join(currentDir, "claude2cn.user-temp.js");
const outputPath = join(currentDir, "claude2cn.user.js");

// 第一步：处理 en2cn.json → TRANSLATIONS
console.log("正在读取 en2cn.json...");
const en2cnData = sortObjectKeys(JSON.parse(readFileSync(join(currentDir, "en2cn.json"), "utf8")));
writeFileSync(join(currentDir, "en2cn.json"), JSON.stringify(en2cnData, null, 2), "utf8");
console.log("✅ en2cn.json 排序完成");

// 第二步：处理 design.json → DESIGN_TRANSLATIONS
console.log("正在读取 design.json...");
const designData = sortObjectKeys(JSON.parse(readFileSync(join(currentDir, "design.json"), "utf8")));
writeFileSync(join(currentDir, "design.json"), JSON.stringify(designData, null, 2), "utf8");
console.log("✅ design.json 排序完成");

// 第三步：读取模板，替换两个占位符，输出 claude2cn.user.js
console.log("\n正在读取模板...");
let output = readFileSync(templatePath, "utf8");

const translationsPlaceholder = "  const TRANSLATIONS = {};";
if (!output.includes(translationsPlaceholder)) {
  console.error(`错误：找不到占位符: "${translationsPlaceholder}"`);
  process.exit(1);
}
output = output.replace(translationsPlaceholder, buildBlock("TRANSLATIONS", en2cnData));

const designPlaceholder = "  const DESIGN_TRANSLATIONS = {};";
if (!output.includes(designPlaceholder)) {
  console.error(`错误：找不到占位符: "${designPlaceholder}"`);
  process.exit(1);
}
output = output.replace(designPlaceholder, buildBlock("DESIGN_TRANSLATIONS", designData));

writeFileSync(outputPath, output, "utf8");
console.log(`\n✅ 完成！已生成 claude2cn.user.js`);
