# JSON Reader

Lightweight offline JSON / JSONL table reader.

## Features

- Open local `.json` or `.jsonl` files
- Search, filter, sort, resize columns, and wrap text
- Freeze the first row, first column, or last column
- Double-click cells to edit and save changes locally
- Preserve the original save format: `.json` stays JSON, `.jsonl` stays JSONL
- JSONL parsing fails fast with a 1-based line number for malformed or non-object rows

## Development

```bash
npm install
npm test
npm run build
```

## Single-file version

Open `publish-json-reader/index.html` in Chrome or Edge for the standalone offline version.
Files stay on your computer.
