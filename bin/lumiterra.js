#!/usr/bin/env node

import {
  parse,
  helpText,
  // === core ===
  validateQueryInventory,
  validateQueryNearEntities,
  validateQueryEquipment,
  // === action ===
  validateAutoCombat,
  validateEscapeCombat,
  validateAutoGather,
  validateFish,
  validateSetSkillShortcut,
  validateSetCaptureProp,
  // === animal ===
  validateAnimalPet,
  validateAnimalQuery,
  // === crafting ===
  validateQueryRecipes,
  validateQueryItemSources,
  validateCraftLottery,
  // === equipment ===
  validateEquip,
  validateSwitchWeapon,
  validateEnhanceEquipment,
  validateDismantleEquipment,
  validateClaimDismantlingMats,
  validateDoEquipmentRecovery,
  validateClaimRecycleReward,
  validateQueryDismantlingRecord,
  validateQueryRecyclePool,
  validateQueryRecycleRecord,
  // === farm ===
  validateFarmHoe,
  validateFarmEradicate,
  validateFarmWater,
  validateFarmHarvest,
  validateFarmQuery,
  // === nft ===
  validateNftStake,
  validateNftSmelt,
  validateNftToOnchain,
  validateOnchainNftToGame,
  // === pet ===
  validatePetSummon,
  validatePetFeed,
  validateMakePetEgg,
  validateHatchPet,
  validateClaimPet,
  validatePetWash,
  validateQueryCaptureSetup,
  validateCapturePet,
  // === quest ===
  validateQuestDialog,
  validateQuestNormalClaim,
  validateQuestSubmit,
  validateQuestNormalAbandon,
  validateTokenTaskAccept,
  validateTokenTaskClaim,
  validateTokenTaskAbandon,
  validateTokenTaskRefresh,
  // === survival ===
  validateUseItem,
  validateRevive,
  validateEnergyManage,
  // === talents ===
  validateQueryTalent,
  validateTalentManage,
  // === team-pvp ===
  validateTeamCreate,
  validateTeamDisband,
  validateTeamLeave,
  validateTeamQuery,
  validateTeamInvite,
  validateTeamReply,
  validateEscortAccept,
  validateEscortStatus,
  validateTogglePvp,
} from "../src/parser.js";
import { sendCommand } from "../src/client.js";
import { output, exitCode } from "../src/formatter.js";

let inflightAbort = null;
let sigintCount = 0;
let isExiting = false;

async function notifyServerStop() {
  try {
    await sendCommand("stop", {}, { timeout: 2000 });
  } catch {
    // Silently ignore when the server is unreachable.
  }
}

process.on("SIGINT", async () => {
  sigintCount++;
  if (sigintCount >= 2) {
    process.stderr.write("\nForce exiting\n");
    process.exit(130);
  }
  if (isExiting) return;
  isExiting = true;
  process.stderr.write("\nNotifying the game to stop...(press Ctrl+C again to force exit)\n");
  if (inflightAbort) {
    try { inflightAbort.abort(); } catch { /* ignore */ }
  }
  await notifyServerStop();
  process.exit(130);
});

process.on("SIGTERM", () => {
  process.exit(143);
});

async function main() {
  const { cmd, params, pretty, help } = parse(process.argv.slice(2));

  if (help || !cmd) {
    console.log(helpText());
    process.exit(0);
  }

  const validators = {
    // === core ===
    "query-inventory": validateQueryInventory,
    "query-near-entities": validateQueryNearEntities,
    "query-battle-areas": null,
    "query-equipment": validateQueryEquipment,
    "query-app-info": null,

    // === action ===
    "auto-combat": validateAutoCombat,
    "escape-combat": validateEscapeCombat,
    "auto-gather": validateAutoGather,
    "fish": validateFish,
    "set-skill-shortcut": validateSetSkillShortcut,
    "set-capture-prop": validateSetCaptureProp,

    // === animal ===
    "animal-pet": validateAnimalPet,
    "animal-query": validateAnimalQuery,

    // === crafting ===
    "query-recipes": validateQueryRecipes,
    "query-item-sources": validateQueryItemSources,
    "query-craft-lottery": null,
    "craft-lottery": validateCraftLottery,

    // === equipment ===
    "equip": validateEquip,
    "switch-weapon": validateSwitchWeapon,
    "enhance-equipment": validateEnhanceEquipment,
    "dismantle-equipment": validateDismantleEquipment,
    "claim-dismantling-mats": validateClaimDismantlingMats,
    "do-equipment-recovery": validateDoEquipmentRecovery,
    "claim-recycle-reward": validateClaimRecycleReward,
    "query-dismantling-record": validateQueryDismantlingRecord,
    "query-recycle-pool": validateQueryRecyclePool,
    "query-recycle-record": validateQueryRecycleRecord,

    // === farm ===
    "farm-hoe": validateFarmHoe,
    "farm-eradicate": validateFarmEradicate,
    "farm-water": validateFarmWater,
    "farm-harvest": validateFarmHarvest,
    "farm-query": validateFarmQuery,

    // === nft ===
    "nft-stake": validateNftStake,
    "nft-smelt": validateNftSmelt,
    "nft-to-onchain": validateNftToOnchain,
    "onchain-nft-to-game": validateOnchainNftToGame,

    // === pet ===
    "pet-summon": validatePetSummon,
    "pet-feed": validatePetFeed,
    "make-pet-egg": validateMakePetEgg,
    "hatch-pet": validateHatchPet,
    "claim-pet": validateClaimPet,
    "pet-wash": validatePetWash,
    "query-capture-setup": validateQueryCaptureSetup,
    "capture-pet": validateCapturePet,

    // === quest ===
    "quest-dialog": validateQuestDialog,
    "quest-normal-claim": validateQuestNormalClaim,
    "quest-submit": validateQuestSubmit,
    "quest-normal-abandon": validateQuestNormalAbandon,
    "token-task-accept": validateTokenTaskAccept,
    "token-task-claim": validateTokenTaskClaim,
    "token-task-abandon": validateTokenTaskAbandon,
    "token-task-refresh": validateTokenTaskRefresh,

    // === survival ===
    "use-item": validateUseItem,
    "revive": validateRevive,
    "energy-manage": validateEnergyManage,

    // === talents ===
    "query-talent": validateQueryTalent,
    "talent-manage": validateTalentManage,

    // === team-pvp ===
    "team-create": validateTeamCreate,
    "team-disband": validateTeamDisband,
    "team-leave": validateTeamLeave,
    "team-query": validateTeamQuery,
    "team-invite": validateTeamInvite,
    "team-reply": validateTeamReply,
    "escort-accept": validateEscortAccept,
    "escort-status": validateEscortStatus,
    "toggle-pvp": validateTogglePvp,
  };

  const validator = validators[cmd];
  if (validator) {
    const validation = validator(params);
    if (!validation.valid) {
      const errorResponse = { success: false, data: null, earnings: null, errors: [validation.error] };
      output(errorResponse, pretty);
      process.exit(1);
    }
    Object.assign(params, validation.params);
  }

  inflightAbort = new AbortController();
  const response = await sendCommand(cmd, params, { abortController: inflightAbort });
  inflightAbort = null;

  // SIGINT handler is in flight: yield exit control to it so it can
  // finish notifyServerStop() and exit(130). Without this, main() races
  // ahead with exit(1) before the server is told to stop.
  if (isExiting) return;

  output(response, pretty);
  process.exit(exitCode(response));
}

main();
