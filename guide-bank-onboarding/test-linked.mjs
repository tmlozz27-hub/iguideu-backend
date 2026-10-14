import { showGuideBankStatus } from "./bank-ui.mjs";

const elements = {
  linkedBank: { hidden: true },
  bankDetails: { hidden: true }
};

globalThis.document = {
  getElementById(id) {
    return elements[id] || null;
  }
};

const guide = {
  airwallex: {
    beneficiaryId: "CUENTA-DE-PRUEBA"
  }
};

const status = showGuideBankStatus(guide);

if (
  status !== "LINKED" ||
  elements.linkedBank.hidden ||
  !elements.bankDetails.hidden
) {
  throw new Error("FALLO: cuenta vinculada");
}

console.log("OK: CUENTA VINCULADA RECONOCIDA");
console.log("OK: PANTALLA DE CUENTA VINCULADA VISIBLE");
console.log("OK: FORMULARIO DE NUEVA CUENTA OCULTO");
