# RULES.md

> Canonical project rules - single source of truth for all AI agents working in this repository.
> `CLAUDE.md` and `AGENTS.md` are thin `@import` wrappers pointing here. Edit this file only.

## Project Overview

Lumiterra CLI is a game automation interface that lets an AI Agent control a Lumiterra game character through terminal commands.
The repository already implements multiple L1 workflows, including combat/gathering/farming dailies, crafting, fishing, equipment enhancement, equipment dismantling, equipment recycle-pool airdrops, totem usage, escort missions, pet training, pet egg creation, NFT staking/smelting, and main/side quests.

## Architecture

Three layers are strictly separated:

```text
Human / AI Agent
    | shell: lumiterra quest-list --type daily
    v
Node.js CLI (this repository)  <- pure pipeline: args -> local command bridge -> stdout JSON
    | local command bridge (localhost:24366-24375)
    v
Game runtime                   <- companion game runtime repository
```

- **CLI (this repository)**: parses arguments, calls the local command bridge, and prints stdout JSON. It contains no game logic.
- **Game runtime**: background local-command entry point -> `UniTask.SwitchToMainThread()` -> Handler calls game APIs -> JSON response.
- **Command Handler**: one handler per command, implementing `ICliCommandHandler` and calling existing game modules.

## Tech Stack

- Node.js (>=18), ESM modules (`"type": "module"`)
- Zero external dependencies (uses built-in Node.js `fetch`, `node:test`, and `node:assert`)
- Installation method: `npm link` (local global link)

## Build & Test Commands

```bash
# Run all unit tests
node --test tests/parser.test.js tests/client.test.js

# Run one test file
node --test tests/parser.test.js

# Install the CLI locally
npm link

# Integration tests (requires the game to be running)
bash tests/integration/test-all-commands.sh
```

## File Structure

```text
bin/lumiterra.js       # CLI entry point (#!/usr/bin/env node)
src/parser.js          # argv -> {cmd, params, pretty, help}
src/client.js          # local command bridge wrapper (auto-discovers localhost:24366-24375)
src/formatter.js       # JSON -> stdout + exitCode
skills/                # Agent Skill files (teach AI agents how to use commands)
tests/                 # unit tests + integration tests
docs/commands.md       # command reference manual (complete parameters and response format)
docs/workflows.md      # Agent L1 workflow design notes
docs/atoms.md          # shared operation atoms on the game runtime side
```

## Commands

See [docs/commands.md](docs/commands.md) for the complete command list, parameters, and response formats.

## Command Design Principles

- **One command per Agent decision point** - split a step into its own command only when the Agent must make a choice there.
- **Package deterministic sequences** - consecutive steps that do not require Agent choices are combined into one command,
  for example `craft-execute` includes navigation -> interaction -> submit -> wait -> extract.
- **The CLI is a pure pipeline** - it does not make game-logic judgments and does not choose strategy for the Agent.
- **Prefer short commands** - long-running operations such as combat return at the smallest useful granularity by default (`auto-combat` kills one target by default).
  The Agent drives the outer loop and makes decisions between rounds, such as checking HP and quest progress.
- **Automation should be weaker than a human** - for skill-based actions such as fishing QTE or combat execution, CLI automation should be worse overall than a real human player to preserve fairness.
  For example, fishing QTE should randomly produce Good/Bad results instead of always Perfect, and combat should not use superhuman reaction speed.

## Energy Gate System

Energy gates almost every drop except fishing:
- Monster combat / gathering / crop harvest / animal petting: no energy -> no drops.
- World soil hoeing: no energy -> action is blocked directly.
- Fishing: does not consume energy and is not limited by energy.

Agents must check energy (`query-status` returns the `energy` field) before every yield-producing workflow except fishing.

### Passing Data Between Commands

Commands pass data through return values. The Agent extracts parameters for the next command from the previous command response:

```text
quest-list -> subtask.monsterCid -> auto-combat --target
quest-list -> subtask.guidePos   -> navigate --x --y --z
query-recipes -> recipe.id      -> craft-execute --recipe
query-item-sources -> source    -> choose next step by type
query-spawn-point -> navPosition -> navigate --x --y --z
quest-normal-list -> acceptNpc.cid -> quest-dialog --npc-cid
query-spawn-point(--type gather --cid) -> navPosition / center -> navigate
query-spawn-point(--type farm --cid)  -> navPosition / center -> navigate
query-spawn-point(--type animal --cid) -> navPosition / center -> navigate
farm-query -> soils[].soilId    -> farm-hoe/farm-water/farm-harvest --soil-id
animal-query -> animals[].entityId -> animal-pet --entity-id
query-totem-list / query-near-totem -> totem pos -> totem-teleport --x --y --z
query-pets -> pet.id            -> pet-summon --pet-id
```

See [docs/workflows.md](docs/workflows.md) for Agent workflow orchestration.

## Unified Response Format

All commands return the same JSON shape:
```json
{"success": true, "data": {}, "earnings": null, "errors": []}
```

- `success`: whether execution succeeded.
- `data`: command-specific data.
- `earnings`: rewards gained by this operation, or null when there are none.
- `errors`: array of error messages.

When a multi-step command such as `craft-execute` fails, `data.stage` indicates the failed stage (`navigate` / `interact` / `craft_submit` / `craft_wait` / `craft_extract`).
Agents use it to choose a retry strategy.

## ID Field Stringification Convention (Large Integer Precision)

**Rule:** In JSON exchanged between the CLI and game runtime, every ID field whose source type is `long` / `ulong` or whose value may exceed int range must be represented as a string.

**Reason:** JavaScript `JSON.parse` parses JSON numbers as IEEE 754 doubles. The safe integer limit is `Number.MAX_SAFE_INTEGER = 2^53 - 1 ~= 9e15`.
Game runtime IDs such as soil id (`ulong`, max 2^64), animal entity id (`long`, max 2^63), and player id (`long`) may exceed 2^53. Passing them through JS numbers silently truncates them, for example `18444535670245883907` becomes `18444535670245884000`, and then the Agent cannot query the entity again with the returned id.

**Applicable fields (not exhaustive):**
- Request parameters: `--soil-id`, `--animal-id`, `--totem-id`, `--pet-id`, `--entity-id` (anything pointing to a game runtime `long`/`ulong` value).
- Response fields: `soilId`, `entityId`, `ownerId`, `animalCid` when a config id can exceed int range, and similar fields.

**Implementation constraints:**
- **CLI side (Node.js):** validators in `src/parser.js` must preserve positive integer arguments as their original strings.
  Do not use `Number(raw)` or `parseInt(raw)`. `parsePositiveInt` validates with a regex and returns the original string.
- **Game runtime side (C#):** handlers parse with `CliParams.GetULong()` / `GetLong()`; internally `ulong.TryParse(val.ToString())` handles strings correctly. When services write response dictionaries, id fields must call `.ToString()` instead of storing raw `ulong`/`long` objects.
- **Allowed exceptions:** fields guaranteed to fit in int range, such as `animalCid` config-table ids, `nextOpTime` seconds, and `requiredHappiness`, remain numbers.

## Key Design Decisions

- Commands pass data by return values; ids and target locations returned by `quest-list` become parameters for later commands.
- The game runtime uses async execution plus `CancellationToken` for timeouts and death interruption.
- The local command bridge listens from port 24366 by default and tries up to 24375. When `LUMITERRA_HOST` is not set, the CLI scans that range and chooses the lowest available Lumiterra instance. Multi-instance or custom-port setups can override this with `LUMITERRA_HOST`.

## Related Repository

Game runtime repository:
Companion repository that implements the local command bridge and game-side handlers.

## Stop and SIGINT Behavior (Base Design)

**Convention:** When the CLI process is interrupted by `Ctrl+C` (SIGINT), it must first send a `stop` request to the game side so the server cancels the current long-running command, then exit.
This uses the same path as user-invoked `lumiterra stop`, with the same meaning: notify the server to cancel.

**Implementation location:** the `process.on("SIGINT", ...)` handler in `bin/lumiterra.js`. New subcommands do **not** need independent SIGINT handling; the logic is centralized in `bin/lumiterra.js`.

**Behavior contract:**
- First SIGINT: abort current fetch + send `stop` (wait up to 2s) + exit(130).
- Second SIGINT: exit(130) immediately.
- SIGTERM: exit(143) immediately and do not send stop, because kill scenarios usually have tighter timing.

**Client 2s vs server 3s tradeoff:**
In SIGINT scenarios the client fetch timeout is 2s, shorter than the server drain limit of 3s. The user has already pressed Ctrl+C, so waiting longer feels poor; after the client aborts, server draining still completes naturally.
Direct `lumiterra stop` calls use the normal fetch timeout and can receive the full `drained` field. This difference is intentional.

**Cross-reference:** server-side cancellation semantics are documented in the companion game runtime repository rules.

## Skill Documentation Rules

All documents under `skills/lumiterra/` (`SKILL.md` + `references/`) are written **for AI agents**, not for human readability.

### Audience Constraints

- **Audience:** AI agents (Claude Code / Cursor / Codex / Copilot / Cline, etc.).
- **Non-audience:** humans. Humans should use `docs/CHEATSHEET.md`; a future `README.md` would also use a human-oriented voice.

### Writing Style

- Compact tables are preferred over prose.
- Use directive language: **MUST**, **NEVER**, **HARD RULE**.
- Repetition is allowed; hard rules may appear both in `SKILL.md` and once in references to resist dilution.
- Numbered steps must be explicit; do not say that steps 1-2 may be merged.
- Use English prose, while preserving command names, parameters, enum values, workflow ids, and protocol field names exactly.

### Forbidden Content

- Architecture diagrams, which belong in `docs/CHEATSHEET.md` or a future README.
- Tech Stack / Build & Test Commands, which belong in this file or a future README.
- Design-history explanations or historical decisions; remove them because agents do not need them.
- Human-oriented filler, transition sentences, or motivational language.
- Complex long paragraphs; split them into concise bullets.

### Required Content

- Hard directives: preconditions, forbidden actions, safety thresholds.
- Command references in the form `lumiterra xxx --flag value`.
- Numbered execution steps for workflows.
- Trigger keywords in frontmatter `description` or at the beginning of the document.
- Pitfall warnings, especially for 64-bit IDs and response formats.
- "Referenced by / references" links for sub-workflows.

### Source-of-Truth Principle

| Content | Source of truth |
|---|---|
| Command interface (names, flags) | `src/parser/help.js` + `src/parser/validators/*.js` |
| Earn workflows (L1-X) | `skills/lumiterra/references/earn-workflows/*.md` |
| Base workflows (SW-X) | `skills/lumiterra/references/base-workflows/*.md` |
| Hard rules / pitfalls | `skills/lumiterra/SKILL.md` (inline source, not split into standalone files) |
| Command reference | `skills/lumiterra/references/commands/*.md` (Phase 2 may make this generated) |
| Human cheatsheet | `docs/CHEATSHEET.md` (jump table only, not a source of truth) |

### PR Synchronization Rules

- **When changing `src/parser/help.js` or `src/parser/validators/*.js`, you must sync the corresponding `references/commands/*.md` file.** Phase 2 auto-lint was removed, so this rule permanently depends on manual review and code review.
- Workflow changes go directly into the matching `references/earn-workflows/*.md` or `references/base-workflows/*.md`.
- Hard rule / pitfall changes go directly into `SKILL.md`.
- **Any skill document change must be validated against code:** referenced `lumiterra xxx` commands and `--flag` names must exist in `help.js` / `validators/`.

### Code-to-Documentation 1:1 Mapping (Since Phase 1.5)

Every `references/commands/*.md` file has a same-name `validators/*.js` file. A few no-parameter commands may use an empty validator file, for example `totem.js`. The section order in `help.js` also matches the command file order.

| commands/*.md | validators/*.js | help.js group section |
|---|---|---|
| core.md | core.js | General query commands |
| action.md | action.js | Action commands |
| animal.md | animal.js | Wild animal commands |
| crafting.md | crafting.js | Crafting commands |
| equipment.md | equipment.js | Equipment commands |
| farm.md | farm.js | Farm commands |
| nft.md | nft.js | NFT commands |
| pet.md | pet.js | Pet commands |
| quest.md | quest.js | Quest commands + token-pool task commands |
| survival.md | survival.js | Survival and energy commands |
| talents.md | talents.js | Talent commands |
| team-pvp.md | team-pvp.js | Team + escort + PvP commands |
| totem.md | totem.js (placeholder) | Totem commands |
