# Stop Integration Tests

Verify that all CLI commands with `IsLongRunning => true` can truly stop within <= 2 seconds
under a stop signal, and that `drained: true` is returned.

## Preconditions

1. **The game client must be running** (local runtime or build artifact), listening on one port in `localhost:24366-24375`.
2. The character is logged in, alive, and not inside a dungeon.
3. It is recommended that the character be near the novice village center (each test's navigate target is based on this).
4. Run tests serially; do not run them concurrently.

## Running Tests

```bash
# Run all stop tests
npm run test:integration:stop

# Run a single test
node --test tests/integration/stop/navigate.test.js
```

## When Adding a Long Command

For a newly added handler with `IsLongRunning => true`, it is recommended to add a corresponding test in this directory.
This is not mandatory -- as long as the two rules in the game runtime repository are followed: "declare long/short" + "pass ct through", the mechanism itself
ensures stop is usable. Tests are regression protection and can be added by business modules as needed.
(See the cancellation semantics description in the game runtime repository rules.)

## Test Template

Refer to existing tests and use `runCommandAndStop` from `_helpers.js`. Every case must assert:

- `stopResp.success === true`
- `stopResp.data.stoppedCommands` includes the tested command name
- `stopResp.data.drained === true`
- `stopElapsedMs < 2000`
- `longResp.data.endReason === "cancelled"`

## Monster / Resource CID Configuration

Some tests hardcode CIDs and must be calibrated against the actual game environment before running:

- `auto-combat.test.js`: `TARGET_MONSTER_CID` -- small monster visible in novice village
- `auto-gather.test.js`: `TARGET_RESOURCE_CID` -- gatherable resource visible in novice village
- `capture-pet.test.js`: `TARGET_ANIMAL_CID` -- capturable animal in novice village
- `craft-execute.test.js`: `RECIPE_CID` -- a simple usable recipe CID
- `totem-teleport.test.js`: `TOTEM_ID` -- Totem ID near the character
- `back-to-town.test.js`: no configuration needed; if back-to-town finishes within 300ms, the test skips assertions and prints a hint

This can later be changed to read environment variables.
