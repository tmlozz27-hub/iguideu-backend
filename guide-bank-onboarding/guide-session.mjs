let activeGuideToken = null;

export function getAuthenticatedGuideToken() {
  if (!activeGuideToken) {
    throw new Error("GUIDE_NOT_AUTHENTICATED");
  }

  return activeGuideToken;
}

export async function loadAuthenticatedGuide(token) {
  activeGuideToken = null;

  const response = await fetch("https://api.i-guide-u.com/api/guides/me/bank-status", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store",
    credentials: "omit"
  });

  if (!response.ok) {
    throw new Error("BANK_STATUS_REQUEST_FAILED");
  }

  const data = await response.json();

  if (
    data?.ok !== true ||
    !["LINKED", "NOT_LINKED", "REVIEW_REQUIRED"].includes(data.bankStatus)
  ) {
    throw new Error("BANK_STATUS_INVALID_RESPONSE");
  }

  const linkedBank = document.getElementById("linkedBank");
  const bankDetails = document.getElementById("bankDetails");

  if (!linkedBank || !bankDetails) {
    throw new Error("BANK_UI_NOT_FOUND");
  }

  const profileResponse = await fetch("https://api.i-guide-u.com/api/auth/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "omit",
    cache: "no-store"
  });

  if (!profileResponse.ok) {
    throw new Error("GUIDE_PROFILE_REQUEST_FAILED");
  }

  const profileData = await profileResponse.json();
  const profile = profileData.user || profileData;

  const selectedLanguage = String(profile.language || "")
    .trim()
    .toLowerCase();

  window.guideBankLanguage =
    selectedLanguage.startsWith("en") ? "en" : "es";

  document.documentElement.lang = window.guideBankLanguage;

  window.dispatchEvent(new CustomEvent("guide-language-change", {
    detail: { language: window.guideBankLanguage }
  }));

  activeGuideToken = token;

  linkedBank.hidden = data.bankStatus !== "LINKED";
  bankDetails.hidden = data.bankStatus !== "NOT_LINKED";

  return data.bankStatus;
}
