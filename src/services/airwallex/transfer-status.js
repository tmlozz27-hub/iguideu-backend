export function classifyAirwallexTransfer(transfer) {
  if (!transfer || !transfer.id) {
    throw new Error("AIRWALLEX_TRANSFER_DETAILS_REQUIRED");
  }

  const status = String(transfer.status || "").toUpperCase();

  switch (status) {
    case "PAID":
      return "COMPLETED";

    case "PROCESSING":
    case "SCHEDULED":
    case "PENDING":
      return "PROCESSING";

    case "SENT":
      return "SENT";

    case "FAILED":
    case "CANCELLED":
      return "RECONCILIATION_REQUIRED";

    default:
      return "RECONCILIATION_REQUIRED";
  }
}
