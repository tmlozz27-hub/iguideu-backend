export function assertAirwallexLivePayoutsEnabled() {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (process.env.AIRWALLEX_LIVE_PAYOUTS_ENABLED !== "true") {
    throw new Error("AIRWALLEX_LIVE_PAYOUTS_DISABLED");
  }

  return true;
}
