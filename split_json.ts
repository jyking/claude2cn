import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { basename, dirname, extname, join } from "path";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function getOutputPath(inputPath: string, index: number): string {
  const fileExt = extname(inputPath);
  const fileName = basename(inputPath, fileExt);
  const parentDir = dirname(inputPath);
  const outputDir = join(parentDir, `${fileName}_parts`);

  mkdirSync(outputDir, { recursive: true });

  return join(
    outputDir,
    `${fileName}.part${String(index + 1).padStart(3, "0")}${fileExt || ".json"}`,
  );
}

function countLines(value: JsonValue): number {
  return JSON.stringify(value, null, 2).split("\n").length;
}

function splitObject(
  source: Record<string, JsonValue>,
  maxLines: number,
): Record<string, JsonValue>[] {
  const entries = Object.entries(source);
  const chunks: Record<string, JsonValue>[] = [];

  let currentChunk: Record<string, JsonValue> = {};
  let currentLines = 2;

  for (const [key, value] of entries) {
    const entryLines = countLines({ [key]: value }) - 2;

    if (Object.keys(currentChunk).length > 0 && currentLines + entryLines > maxLines) {
      chunks.push(currentChunk);
      currentChunk = {};
      currentLines = 2;
    }

    currentChunk[key] = value;
    currentLines += entryLines;
  }

  if (Object.keys(currentChunk).length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function splitArray(source: JsonValue[], maxLines: number): JsonValue[][] {
  const chunks: JsonValue[][] = [];

  let currentChunk: JsonValue[] = [];
  let currentLines = 2;

  for (const item of source) {
    const itemLines = countLines([item]) - 2;

    if (currentChunk.length > 0 && currentLines + itemLines > maxLines) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLines = 2;
    }

    currentChunk.push(item);
    currentLines += itemLines;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function mergeParts(partsDir: string, outputPath: string): void {
  const partFiles = readdirSync(partsDir)
    .filter((fileName) => /\.part\d+\.json$/.test(fileName))
    .sort((left, right) => {
      const leftIndex = Number(left.match(/\.part(\d+)\.json$/)?.[1]);
      const rightIndex = Number(right.match(/\.part(\d+)\.json$/)?.[1]);
      return leftIndex - rightIndex;
    });

  if (partFiles.length === 0) {
    throw new Error(`目录中没有找到分片 JSON 文件: ${partsDir}`);
  }

  const parts = partFiles.map((fileName) => {
    const filePath = join(partsDir, fileName);
    return JSON.parse(readFileSync(filePath, "utf8")) as JsonValue;
  });

  const firstPart = parts[0];
  let merged: JsonValue;

  if (Array.isArray(firstPart)) {
    if (!parts.every((part) => Array.isArray(part))) {
      throw new Error("分片文件类型不一致，无法合并");
    }
    merged = parts.flatMap((part) => part as JsonValue[]);
  } else if (firstPart !== null && typeof firstPart === "object") {
    if (!parts.every((part) => part !== null && typeof part === "object" && !Array.isArray(part))) {
      throw new Error("分片文件类型不一致，无法合并");
    }
    merged = Object.assign({}, ...parts);
  } else {
    throw new Error("分片内容必须是顶层 object 或 array");
  }

  writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  console.log(`已合并: ${outputPath}`);
}

function main() {
  const command = process.argv[2];

  if (command === "merge") {
    const partsDir = process.argv[3];
    const outputPath = process.argv[4];
    if (!partsDir || !outputPath) {
      console.error("用法: bun run split_json.ts merge <分片目录> <输出文件路径>");
      process.exit(1);
    }
    try {
      mergeParts(partsDir, outputPath);
    } catch (error) {
      console.error(`错误: 无法合并分片目录 ${partsDir}`);
      console.error(error);
      process.exit(1);
    }
    return;
  }

  const inputPath = command;
  const maxLines = Number(process.argv[3] ?? "500");

  if (!inputPath) {
    console.error("用法: bun run split_json.ts <json文件路径> [每片最大行数]");
    console.error("或:   bun run split_json.ts merge <分片目录> <输出文件路径>");
    process.exit(1);
  }

  if (!Number.isInteger(maxLines) || maxLines < 3) {
    console.error("错误: 每片最大行数必须是大于等于 3 的整数");
    process.exit(1);
  }

  let parsed: JsonValue;
  try {
    parsed = JSON.parse(readFileSync(inputPath, "utf8")) as JsonValue;
  } catch (error) {
    console.error(`错误: 无法读取或解析 JSON 文件 ${inputPath}`);
    console.error(error);
    process.exit(1);
  }

  if (parsed === null || typeof parsed !== "object") {
    console.error("错误: 仅支持顶层为 object 或 array 的 JSON");
    process.exit(1);
  }

  const chunks = Array.isArray(parsed)
    ? splitArray(parsed, maxLines)
    : splitObject(parsed as Record<string, JsonValue>, maxLines);

  chunks.forEach((chunk, index) => {
    const outputPath = getOutputPath(inputPath, index);
    writeFileSync(outputPath, `${JSON.stringify(chunk, null, 2)}\n`, "utf8");
    console.log(`已生成: ${outputPath}`);
  });

  console.log(`完成: 共切成 ${chunks.length} 个合法 JSON 文件`);
}

main();
