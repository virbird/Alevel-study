#!/bin/bash
# 构建并安装到 Obsidian vault 插件目录（每次改代码后执行：npm run build && ./install.sh [vault]）
# 注意：Obsidian 加载的是 vault/.obsidian/plugins/alevel-study-coach/ 下的 main.js，
# 只 build 不 install 会导致插件运行旧代码（改动「没有效果」）。
set -e
VAULT="${1:-/Users/lutang/Documents/eva-study-gj}"
cd "$(dirname "$0")"

npm run build

PLUGIN_DIR="$VAULT/.obsidian/plugins/alevel-study-coach"
cp main.js manifest.json styles.css "$PLUGIN_DIR/"
rm -rf "$PLUGIN_DIR/templates"
cp -r templates "$PLUGIN_DIR/"

echo "✅ 已安装到 $PLUGIN_DIR —— 请在 Obsidian 设置 → 第三方插件 → 重新加载插件后生效"
