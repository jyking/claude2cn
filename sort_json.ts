import { existsSync, readFileSync, writeFileSync } from "fs";
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

const USERSCRIPT_HEADER = (name: string, description: string, version: string): string =>
  `// ==UserScript==
// @name         ${name}
// @namespace    https://github.com/jyking/claude2cn/
// @homepageURL  https://github.com/jyking/claude2cn/
// @author       jyking
// @version      ${version}
// @description  ${description}
// @license      MIT
// ==/UserScript==`;

// 累加式分片：每个文件都先把本片词条合并进全局 TRANSLATIONS。
// `var TRANSLATIONS = typeof ...` 保证首片声明、后续片累加，
// 顺序无关、可单独加载（油猴 @require / 扩展 manifest / 远程 eval 均适用）。
function buildPartFile(name: string, description: string, version: string, data: any): string {
  const lines = JSON.stringify(data, null, 2).split("\n"); // ["{", "  \"k\": ...", "}"]
  const body = [`Object.assign(TRANSLATIONS, {`, ...lines.slice(1, -1), `});`].join("\n");
  return `${USERSCRIPT_HEADER(name, description, version)}
var TRANSLATIONS = typeof TRANSLATIONS !== "undefined" ? TRANSLATIONS : {};
${body}
`;
}

// extra 覆盖层：手动维护，构建只在文件缺失时创建空模板，
// 已存在则仅同步 @version，绝不覆盖用户内容（优先级最高，最后加载）。
const EXTRA_TEMPLATE_BODY = `var TRANSLATIONS = typeof TRANSLATIONS !== "undefined" ? TRANSLATIONS : {};
Object.assign(TRANSLATIONS, {
  // 在此新增或覆盖翻译词条，优先级最高（在 1/2/3 之后加载）
});
`;

function buildExtraTemplate(version: string): string {
  return `${USERSCRIPT_HEADER(
    "claude2cn-translations-extra",
    "Claude 中文汉化词库 新增/覆盖层（手动维护，构建不覆盖内容）",
    version,
  )}\n${EXTRA_TEMPLATE_BODY}\n`;
}

const currentDir = "./";
const mainPath = join(currentDir, "claude2cn.user.js");

// 读取并排序 en2cn.json
console.log("正在读取 en2cn.json...");
const en2cnData = sortObjectKeys(JSON.parse(readFileSync(join(currentDir, "en2cn.json"), "utf8")));
writeFileSync(join(currentDir, "en2cn.json"), JSON.stringify(en2cnData, null, 2), "utf8");
console.log("✅ en2cn.json 排序完成");

// 从 user.js 提取版本号
const mainContent = readFileSync(mainPath, "utf8");
const versionMatch = mainContent.match(/@version\s+([\d.\w-]+)/);
if (!versionMatch) {
  console.error("错误：找不到 @version");
  process.exit(1);
}
const version = versionMatch[1];
console.log(`\n版本号: ${version}`);

// 按字母序均分为 3 片（按词条数三等分，边界稳定）
const entries = Object.entries(en2cnData);
const third = Math.ceil(entries.length / 3);
const chunks = [0, 1, 2].map((i) =>
  Object.fromEntries(entries.slice(i * third, (i + 1) * third)),
);
console.log(`\n词条总数 ${entries.length}，每片约 ${third} 条`);

// 生成 3 个分片文件
console.log("\n正在生成分片词库文件...");
chunks.forEach((chunk, index) => {
  const n = index + 1;
  const outPath = join(currentDir, `claude2cn-translations-${n}.user.js`);
  writeFileSync(
    outPath,
    buildPartFile(
      `claude2cn-translations-${n}`,
      `Claude 中文汉化词库（${n}/3）`,
      version,
      chunk,
    ),
    "utf8",
  );
  console.log(`✅ claude2cn-translations-${n}.user.js  (${Object.keys(chunk).length} 条)`);
});

// extra 覆盖层：缺失才建，已存在仅同步 @version
const extraPath = join(currentDir, "claude2cn-translations-4.user.js");
if (!existsSync(extraPath)) {
  writeFileSync(extraPath, buildExtraTemplate(version), "utf8");
  console.log("✅ claude2cn-translations-4.user.js  (新建空模板)");
} else {
  const extraContent = readFileSync(extraPath, "utf8");
  const updatedExtra = extraContent.replace(/(@version\s+)[\d.\w-]+/, `$1${version}`);
  if (updatedExtra !== extraContent) {
    writeFileSync(extraPath, updatedExtra, "utf8");
    console.log(`✅ claude2cn-translations-4.user.js  @version 已同步为 v${version}`);
  } else {
    console.log("✅ claude2cn-translations-4.user.js  (无版本变化，内容已保留)");
  }
}

// 同步 user.js 中 @require 的版本号（?v 查询，对 GreasyFork 与 GitHub raw 均作缓存失效）
const updatedMain = mainContent.replace(
  /(@require\s+https:\/\/[^\s?]+)(\?v[\d.\w-]+)?/g,
  `$1?v${version}`,
);
if (updatedMain !== mainContent) {
  writeFileSync(mainPath, updatedMain, "utf8");
  console.log(`\n✅ claude2cn.user.js 中 @require 版本已同步为 v${version}`);
}

// 同步 claude2cn-design.user.js 的 @version
const designPath = join(currentDir, "claude2cn-design.user.js");
const designContent = readFileSync(designPath, "utf8");
const updatedDesign = designContent.replace(/(@version\s+)[\d.\w-]+/, `$1${version}`);
if (updatedDesign !== designContent) {
  writeFileSync(designPath, updatedDesign, "utf8");
  console.log(`✅ claude2cn-design.user.js @version 已同步为 v${version}`);
}
