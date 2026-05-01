import { splitCommaSeparatedValues } from "../utils.js";

export function validateNftStake(params) {
  if (!params.items) {
    return { valid: false, error: "Missing required parameter: --items (format: nftId1:num1,nftId2:num2,...)" };
  }
  const pairs = String(params.items).split(",").map((s) => s.trim()).filter(Boolean);
  if (pairs.length === 0) {
    return { valid: false, error: "--items cannot be empty" };
  }
  if (pairs.length > 20) {
    return { valid: false, error: "nft-stake supports at most 20 nftIds" };
  }
  for (const pair of pairs) {
    const [nftId, numStr] = pair.split(":");
    if (!nftId || !numStr) {
      return { valid: false, error: `Invalid --items format: "${pair}"; each item must be nftId:num` };
    }
    const num = Number(numStr);
    if (!Number.isInteger(num) || num <= 0) {
      return { valid: false, error: `num in --items must be a positive integer: "${pair}"` };
    }
  }
  return { valid: true, params: { ...params, items: pairs.join(",") } };
}

export function validateNftSmelt(params) {
  if (!params["staked-nft-ids"]) {
    return { valid: false, error: "Missing required parameter: --staked-nft-ids" };
  }
  const stakedNftIds = splitCommaSeparatedValues(String(params["staked-nft-ids"]));
  if (stakedNftIds.length === 0) {
    return { valid: false, error: "Missing required parameter: --staked-nft-ids" };
  }
  if (stakedNftIds.length > 20) {
    return { valid: false, error: "nft-smelt supports at most 20 staked-nft-ids" };
  }
  return { valid: true, params: { ...params, "staked-nft-ids": stakedNftIds.join(",") } };
}

export function validateNftToOnchain(params) {
  const nftId = params["nft-id"] != null ? String(params["nft-id"]).trim() : "";
  if (nftId === "") {
    return { valid: false, error: "Missing required parameter: --nft-id" };
  }
  const amount = Number(params.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { valid: false, error: "--amount must be a positive integer" };
  }
  return { valid: true, params: { ...params, "nft-id": nftId, amount: String(amount) } };
}

export function validateOnchainNftToGame(params) {
  const nftId = params["nft-id"] != null ? String(params["nft-id"]).trim() : "";
  if (nftId === "") {
    return { valid: false, error: "Missing required parameter: --nft-id" };
  }
  const amount = Number(params.amount);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return { valid: false, error: "--amount must be a positive integer" };
  }
  return { valid: true, params: { ...params, "nft-id": nftId, amount: String(amount) } };
}
