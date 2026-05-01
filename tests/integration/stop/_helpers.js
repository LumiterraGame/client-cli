export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Get the current character coordinates for building a nearby navigation target.
 * @returns {Promise<{x: number, y: number, z: number}>}
 */
export async function getCurrentPosition(sendCommand) {
  const resp = await sendCommand("query-status", {});
  if (!resp?.success || !resp.data?.position) {
    throw new Error(`query-status failure: ${JSON.stringify(resp)}`);
  }
  return resp.data.position;
}

/**
 * Find a nearby target that produces a real running navigate command before stop is tested.
 *
 * A fixed offset such as +30/+30 can land on non-walkable terrain, water, or obstacles,
 * which makes NavMesh fail immediately. Try eight directions in order:
 *   - start one navigate attempt and wait 800ms
 *   - if a response arrives within 800ms, the command ended immediately, so try next direction
 *   - if no response arrives, navigate is still running; stop it and return that target
 *
 * This helper intentionally starts and stops a short navigation probe so the actual stop
 * test can use a target that the server accepts as a long-running command.
 *
 * @returns {Promise<{x: number, y: number, z: number}>}
 */
export async function navigateTargetOffset(sendCommand) {
  const pos = await getCurrentPosition(sendCommand);
  const directions = [
    [30, 30], [-30, -30], [30, -30], [-30, 30],
    [50, 0], [0, 50], [-50, 0], [0, -50],
  ];

  for (const [dx, dz] of directions) {
    const target = { x: pos.x + dx, y: pos.y, z: pos.z + dz };
    let resolved = false;
    const navPromise = sendCommand("navigate", target).then((r) => {
      resolved = true;
      return r;
    });
    await sleep(800);
    if (!resolved) {
      // navigate is still running, so this direction has a usable NavMesh route
      await sendCommand("stop", {}, { timeout: 5000 });
      await navPromise;  // drain the probe navigation promise
      return target;
    }
    // The command returned immediately, likely due to NavMesh failure or already-at-target.
    await navPromise;
  }
  throw new Error(
    `could not find a nearby walkable navigation target after ${directions.length} offsets`
  );
}

/**
 * Start a long-running command, wait briefly, then stop it.
 * @returns {Promise<{ longResp, stopResp, stopElapsedMs }>}
 */
export async function runCommandAndStop(sendCommand, longCmd, longParams, opts = {}) {
  const settleMs = opts.settleMs ?? 800;
  const stopTimeoutMs = opts.stopTimeoutMs ?? 5000;

  const longPromise = sendCommand(longCmd, longParams);
  await sleep(settleMs);

  const t0 = Date.now();
  const stopResp = await sendCommand("stop", {}, { timeout: stopTimeoutMs });
  const stopElapsedMs = Date.now() - t0;

  const longResp = await longPromise;
  return { longResp, stopResp, stopElapsedMs };
}
