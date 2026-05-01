# Lumiterra CLI

Lumiterra CLI is a local command-line bridge for controlling a Lumiterra game
client from a terminal or an AI agent. It parses commands, sends them to the
local Lumiterra runtime, and prints JSON responses to stdout.

The CLI does not contain game logic. The game client must be running locally and
must expose the compatible local command bridge.

## Requirements

- Node.js 18 or newer.
- A compatible Lumiterra game runtime running locally.
- The local runtime must listen on one port in `127.0.0.1:24366-24375`, unless
  you set `LUMITERRA_HOST`.

## Installation

```bash
npm install -g @eureka7366/lumiterra-cli
```

After installation, the executable command is:

```bash
lumiterra
```

## Quick Start

```bash
lumiterra --help
lumiterra query-status
lumiterra query-inventory --type material
```

All commands return JSON using this general shape:

```json
{
  "success": true,
  "data": {},
  "earnings": null,
  "errors": []
}
```

## Configuration

By default, the CLI scans `127.0.0.1:24366-24375` and uses the lowest available
Lumiterra runtime.

Use `LUMITERRA_HOST` to target a specific runtime:

```bash
LUMITERRA_HOST=http://127.0.0.1:24366 lumiterra query-status
```

## Documentation

The npm package installs only the CLI runtime. The GitHub repository includes
additional command references, workflow notes, tests, and agent skill material.

Useful repository entry points:

- `docs/CHEATSHEET.md` - human-facing command and workflow index.
- `skills/lumiterra/SKILL.md` - agent-facing usage rules.
- `skills/lumiterra/references/commands/` - command reference documents.
- `tests/` - unit and integration tests.

## Development

```bash
npm test
npm link
lumiterra --help
```

Integration tests require the Lumiterra game runtime to be running locally.

## Publishing

This package is currently published under a personal npm scope:

```bash
npm publish --access public
```

It may later move to an official organization scope. If that happens, the
repository README and npm package metadata will be updated with the new package
name and migration instructions.

## License

Apache-2.0. See `LICENSE`.
