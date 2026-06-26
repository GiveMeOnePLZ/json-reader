# JSONL Support Design

## Goal

Add JSONL as a peer file format to JSON, while preserving the selected format when users save their edits.

## File handling

- The open and save dialogs accept both `.json` and `.jsonl` files.
- `.json` keeps its current behavior: the top-level value must be an array of objects and saving writes a pretty-printed array.
- `.jsonl` is parsed one non-empty line at a time. Each line must decode to an object.
- Saving a `.jsonl` document writes one JSON object per line, with a final newline.

## Error handling

- Blank and whitespace-only JSONL lines are ignored.
- A malformed JSONL line stops the entire load and reports its original 1-based line number.
- A valid JSON value that is not an object also stops the load and reports its line number.

## Validation

- Unit tests cover JSONL success, ignored blank lines, malformed input with the source line number, non-object values, and JSONL serialization.
- Existing JSON parsing behavior remains covered by its current tests.
