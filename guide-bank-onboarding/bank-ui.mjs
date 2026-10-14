import { getGuideBankStatus } from "./bank-status.mjs";

export function showGuideBankStatus(guide) {
  const linked = document.getElementById("linkedBank");
  const form = document.getElementById("bankDetails");

  if (!linked || !form) {
    throw new Error("BANK_SECTIONS_NOT_FOUND");
  }

  const status = getGuideBankStatus(guide);

  linked.hidden = status !== "LINKED";
  form.hidden = status !== "NOT_LINKED";

  return status;
}
