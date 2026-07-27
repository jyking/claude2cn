#!/usr/bin/env bash
# 打包 Edge / Chrome MV3 扩展为可上架 zip。
# zip 根为 manifest.json（商店要求），仅包含运行所需文件。
# 用法: ./package.sh
set -euo pipefail

# 脚本与仓库根目录（允许从任意位置调用）
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# 运行所需文件清单（manifest.json 必须在首位）
FILES=(
  "manifest.json"
  "_locales/zh_CN/messages.json"
  "claude2cn.user.js"
  "claude2cn-design.user.js"
  "claude2cn-translations-1.user.js"
  "claude2cn-translations-2.user.js"
  "claude2cn-translations-3.user.js"
  "claude2cn-translations-4.user.js"
  "icons/icon16.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

# 从 manifest.json 读取版本号
VERSION="$(grep -m1 '"version"' manifest.json | sed 's/.*: *"\([^"]*\)".*/\1/')"
if [ -z "$VERSION" ]; then
  echo "❌ 无法从 manifest.json 读取 version" >&2
  exit 1
fi

OUT_DIR="$ROOT/dist"
OUT="$OUT_DIR/claude2cn-v${VERSION}.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "📦 版本: $VERSION"

# 1) 校验所有文件齐备（缺一即失败，绝不打出残包）
echo "1/3 校验文件…"
for f in "${FILES[@]}"; do
  if [ ! -f "$ROOT/$f" ]; then
    echo "❌ 缺少: $f" >&2
    exit 1
  fi
done

# 2) 复制到暂存目录（保证 zip 内路径相对 manifest.json，无 stray 文件）
echo "2/3 组装暂存目录…"
for f in "${FILES[@]}"; do
  mkdir -p "$STAGE/$(dirname "$f")"
  cp "$ROOT/$f" "$STAGE/$f"
done

# 3) 打包
echo "3/3 打包 zip…"
mkdir -p "$OUT_DIR"
# 若已存在同名包则覆盖
rm -f "$OUT"
( cd "$STAGE" && zip -rq "$OUT" "${FILES[@]}" )

echo ""
echo "✅ 完成: $OUT"
unzip -l "$OUT" | awk 'NR>3 && $4!=""{print "   "$4}' | sed '/^   *$/d' | sort | sed '1i\
包含文件:'
echo ""
echo "   大小: $(du -h "$OUT" | cut -f1)"
echo ""
echo "上架:"
echo "   Edge   → https://partner.microsoft.com/dashboard/microsoftedge/"
echo "   Chrome → https://chrome.google.com/webstore/devconsole/"
