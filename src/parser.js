import { collectMultiValueArgs } from "./parser/utils.js";

const HELP_FLAGS = new Set(["--help", "-help", "--h", "-h"]);

function isHelpFlag(arg) {
  return HELP_FLAGS.has(arg.toLowerCase());
}

/**
 * Parses command-line arguments.
 * lumiterra quest-list --type daily --pretty
 * → { cmd: "quest-list", params: { type: "daily" }, pretty: true }
 */
export function parse(argv) {
  const args = argv.slice(0);

  if (args.length === 0) {
    return { cmd: null, params: {}, pretty: false, help: true };
  }

  const cmd = (args[0].startsWith("--") || isHelpFlag(args[0])) ? null : args.shift();

  const params = {};
  let pretty = false;
  let help = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (isHelpFlag(arg)) {
      help = true;
      continue;
    }

    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (
        (cmd === "query-inventory" && key === "type") ||
        (cmd === "dismantle-equipment" && key === "item-instance-id") ||
        (cmd === "do-equipment-recovery" && key === "item-instance-id") ||
        (cmd === "nft-smelt" && key === "staked-nft-ids")
      ) {
        const values = collectMultiValueArgs(args, i + 1);
        if (values.length > 0) {
          params[key] = values.join(",");
          i += values.consumed;
        } else {
          params[key] = true;
        }
        continue;
      }

      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        params[key] = nextArg;
        i++;
      } else {
        params[key] = true;
      }
    }
  }

  return { cmd, params, pretty, help };
}

export { helpText } from "./parser/help.js";
export * from "./parser/validators/action.js";
export * from "./parser/validators/animal.js";
export * from "./parser/validators/core.js";
export * from "./parser/validators/crafting.js";
export * from "./parser/validators/equipment.js";
export * from "./parser/validators/farm.js";
export * from "./parser/validators/nft.js";
export * from "./parser/validators/pet.js";
export * from "./parser/validators/quest.js";
export * from "./parser/validators/survival.js";
export * from "./parser/validators/talents.js";
export * from "./parser/validators/team-pvp.js";
export * from "./parser/validators/totem.js";
