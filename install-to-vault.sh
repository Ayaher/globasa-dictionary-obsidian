#!/usr/bin/env bash

set -euo pipefail

PLUGIN_ID="globasa-dictionary"

usage() {
	echo "Usage: $0 /path/to/your/obsidian/vault"
}

if [[ $# -ne 1 ]]; then
	usage
	exit 1
fi

VAULT_PATH="$1"
VAULT_OBSIDIAN_PATH="$VAULT_PATH/.obsidian"
PLUGIN_DEST="$VAULT_OBSIDIAN_PATH/plugins/$PLUGIN_ID"
DATA_DEST="$PLUGIN_DEST/data"

if [[ ! -d "$VAULT_PATH" ]]; then
	echo "Error: Vault path does not exist: $VAULT_PATH" >&2
	exit 1
fi

if [[ ! -d "$VAULT_OBSIDIAN_PATH" ]]; then
	echo "Error: '$VAULT_PATH' does not look like an Obsidian vault (.obsidian folder missing)." >&2
	exit 1
fi

if [[ ! -f "package.json" ]]; then
	echo "Error: package.json was not found in the current directory." >&2
	echo "Run this script from the plugin project root." >&2
	exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
	echo "Error: npm is not available in PATH." >&2
	exit 1
fi

if [[ ! -f "manifest.json" || ! -f "styles.css" ]]; then
	echo "Error: Required plugin files are missing in the current directory." >&2
	exit 1
fi

if [[ ! -f "data/word-list.csv" ]]; then
	echo "Error: data/word-list.csv is missing in the current directory." >&2
	exit 1
fi

echo "Building plugin..."
npm run build

if [[ ! -f "main.js" ]]; then
	echo "Error: build did not produce main.js." >&2
	exit 1
fi

mkdir -p "$DATA_DEST"

cp "main.js" "$PLUGIN_DEST/main.js"
cp "manifest.json" "$PLUGIN_DEST/manifest.json"
cp "styles.css" "$PLUGIN_DEST/styles.css"
cp "data/word-list.csv" "$DATA_DEST/word-list.csv"

echo "Installed $PLUGIN_ID to: $PLUGIN_DEST"
echo "In Obsidian, reload community plugins if needed."
