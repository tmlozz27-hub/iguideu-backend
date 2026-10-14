const elements = {
  linkedBank: { hidden: true },
  bankDetails: { hidden: true }
};

globalThis.document = {
  getElementById(id) {
    return elements[id] || null;
  }
};

let simulatedStatus = "LINKED";

globalThis.fetch = async (url, options) => {
  if (url !== "/api/guides/me/bank-status") {
    throw new Error("ENDPOINT_INCORRECTO");
  }

  if (options.headers.Authorization !== "Bearer TOKEN-FICTICIO") {
    throw new Error("TOKEN_INCORRECTO");
  }

  return {
    ok: true,
    async json() {
      return { ok: true, bankStatus: simulatedStatus };
    }
  };
};

const { loadAuthenticatedGuide } =
  await import("./guide-session.mjs");

let status = await loadAuthenticatedGuide("TOKEN-FICTICIO");

if (
  status !== "LINKED" ||
  elements.linkedBank.hidden ||
  !elements.bankDetails.hidden
) {
  throw new Error("FALLO_CUENTA_VINCULADA");
}

console.log("OK: CUENTA VINCULADA");

simulatedStatus = "NOT_LINKED";
status = await loadAuthenticatedGuide("TOKEN-FICTICIO");

if (
  status !== "NOT_LINKED" ||
  !elements.linkedBank.hidden ||
  elements.bankDetails.hidden
) {
  throw new Error("FALLO_CUENTA_NO_VINCULADA");
}

console.log("OK: CUENTA NO VINCULADA");
console.log("OK: ENDPOINT SEGURO INTEGRADO EN PORTAL");
