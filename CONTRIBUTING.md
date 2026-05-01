# Contributing

Thank you for helping improve Lumiterra CLI.

## Local Setup

Use Node.js 18 or newer.

```bash
npm test
npm link
lumiterra --help
```

The CLI talks to a local Lumiterra game runtime. Unit tests do not require the
game runtime. Integration tests do.

## Tests

Run all unit tests:

```bash
npm test
```

Run integration tests only when a compatible Lumiterra runtime is already
running locally:

```bash
npm run test:integration
```

## Command Documentation Sync

Command interfaces are defined by:

- `src/parser/help.js`
- `src/parser/validators/*.js`

When changing command names, flags, validation rules, or help text, update the
matching file in `skills/lumiterra/references/commands/`.

Agent workflows live under:

- `skills/lumiterra/references/earn-workflows/`
- `skills/lumiterra/references/base-workflows/`

## Pull Requests

Before opening a pull request:

1. Keep changes focused.
2. Run `npm test`.
3. Include tests for parser, validation, client, or formatter behavior when the
   behavior changes.
4. Update related command or workflow documentation when command behavior
   changes.
5. Avoid committing generated release artifacts, local workspaces, or editor
   files.

## Security

Do not include secrets, private keys, access tokens, game account credentials, or
personal data in issues, pull requests, tests, or documentation.
