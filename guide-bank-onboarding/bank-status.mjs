export function getGuideBankStatus(guide) {
  if (!guide || typeof guide !== "object") {
    return "UNKNOWN";
  }

  const airwallex = guide.airwallex || {};

  if (
    typeof airwallex.beneficiaryId === "string" &&
    airwallex.beneficiaryId.trim() !== ""
  ) {
    return "LINKED";
  }

  return "NOT_LINKED";
}
