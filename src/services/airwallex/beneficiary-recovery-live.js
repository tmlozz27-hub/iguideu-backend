import { airwallexLiveLogin } from "./client-live.js";

export async function findAirwallexLiveBeneficiaryByExternalIdentifier(
  externalIdentifier
) {
  if (process.env.AIRWALLEX_ENV !== "live") {
    throw new Error("AIRWALLEX_LIVE_ONLY");
  }

  if (
    typeof externalIdentifier !== "string" ||
    !/^IGUIDEU-GUIDE-[A-Za-z0-9_-]{3,128}$/.test(externalIdentifier)
  ) {
    throw new Error("INVALID_EXTERNAL_IDENTIFIER");
  }

  const token = await airwallexLiveLogin();
  const matches = [];
  const seenIds = new Set();

  const pageSize = 100;
  const maxPages = 100;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(
      "https://api.airwallex.com/api/v1/beneficiaries"
    );

    url.searchParams.set("page_num", String(page));
    url.searchParams.set("page_size", String(pageSize));

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(
        `AIRWALLEX_BENEFICIARY_LIST_FAILED_${response.status}`
      );
    }

    const result = await response.json();

    if (!Array.isArray(result.items)) {
      throw new Error("AIRWALLEX_BENEFICIARY_LIST_INVALID");
    }

    for (const item of result.items) {
      const id = String(item?.id || "");

      const identifier =
        item?.beneficiary?.additional_info?.external_identifier ??
        item?.additional_info?.external_identifier;

      if (identifier === externalIdentifier) {
        if (!id) {
          throw new Error("AIRWALLEX_MATCH_WITHOUT_ID");
        }

        if (!seenIds.has(id)) {
          seenIds.add(id);
          matches.push({ id });
        }
      }
    }

    if (matches.length > 1) {
      throw new Error("AIRWALLEX_DUPLICATE_BENEFICIARIES_REVIEW_REQUIRED");
    }

    if (result.has_more === false) {
      return {
        found: matches.length === 1,
        beneficiaryId: matches[0]?.id ?? null,
        complete: true
      };
    }

    if (result.items.length === 0) {
      throw new Error("AIRWALLEX_PAGINATION_UNCERTAIN");
    }
  }

  throw new Error("AIRWALLEX_BENEFICIARY_SEARCH_INCOMPLETE");
}
