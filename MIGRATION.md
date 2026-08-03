# Migration from ONA

The extracted collection intentionally changes its namespace:

- Elements: `ona-*` → `mdb-*`
- JavaScript classes: `Ona*` → `Mdb*`
- Events: `ona-*` → `mdb-*`
- CSS classes and custom properties: `.ona-*` / `--ona-*` → `.mdb-*` / `--mdb-*`
- Imports: local files → independent `@mandibula/*` packages

No legacy aliases are registered, which keeps every package isolated and avoids duplicate custom-element definitions. Migrate consumers before removing their existing ONA source bundle.
