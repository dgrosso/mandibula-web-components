# Contributing

Use Node.js 20.19 or newer and install dependencies with `npm install`.

1. Keep each component isolated in its own workspace package.
2. Use the `mdb-` element, event, CSS class, part, and custom-property prefix.
3. Prefer native HTML semantics and preserve keyboard and screen-reader behavior.
4. Add or update browser tests for behavior and public APIs.
5. Run `npm run check` and add a Changeset before opening a pull request.

Bug fixes and features must not require consumers to install the aggregate package.
