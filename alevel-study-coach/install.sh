#!/bin/zsh
# 安装/更新插件到指定 vault：./install.sh /path/to/your/vault
set -e
VAULT="${1:?用法: ./install.sh /path/to/vault}"
DEST="$VAULT/.obsidian/plugins/alevel-study-coach"

npm run build
mkdir -p "$DEST"
cp main.js manifest.json styles.css "$DEST"/
cp -r templates "$DEST"/
echo "已安装到 $DEST"
echo "在 Obsidian 中：设置 → 第三方插件 → 启用 A-Level Study Coach"
