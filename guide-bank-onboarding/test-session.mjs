const elements = {
  linkedBank: { hidden: true },
  bankDetails: { hidden: true }
};

globalThis.document = {
  getElementById(id) {
    return elements[id] || null;
  }
};

globalThis.fetch = async (url, options) => {
  if (url !== "/api/guides/me") {
    throw new Error("ENDPOINT_INESPERADO");
  }

  if (options.headers.Authorization !== "Bearer TOKEN-FICTICIO") {
    throw new Error("TOKEN_INCORRECTO");
  }

  return {
    ok: true,
    async json() {
      return {
        ok: true,
        item: {
          airwallex: {
            beneficiaryId: "BENEFICIARIO-FICTICIO"
          }
        }
      };
    }
  };
};

const { loadAuthenticatedGuide } =
  await import("./guide-session.mjs");

const status = await loadAuthenticatedGuide("TOKEN-FICTICIO");

if (
  status !== "LINKED" ||
  elements.linkedBank.hidden ||
  !elements.bankDetails.hidden
) {
  throw new Error("FALLO_INTEGRACION");
}

console.log("OK: TOKEN ENVIADO AL PERFIL");
console.log("OK: BENEFICIARIO RECONOCIDO");
console.log("OK: PANTALLA CORRECTA");
console.log("OK: INTEGRACION LOCAL SUPERADA");
