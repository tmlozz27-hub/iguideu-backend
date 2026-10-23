import { loadGuideBankSchema, submitGuideBankOnboarding } from "./bank-schema.mjs";
import { renderGuideBankFields } from "./bank-dynamic-fields.mjs";
import { getAuthenticatedGuideToken } from "./guide-session.mjs";

const country = document.getElementById("bank_country_code");
const currency = document.getElementById("account_currency");
const entityType = document.getElementById("entity_type");
const transferMethod = document.getElementById("transfer_method");
const container = document.getElementById("airwallexDynamicFields");
const message = document.getElementById("bankSchemaMessage");

const countryNames = new Intl.DisplayNames(["es"], {
  type: "region"
});

const excludedRegionCodes = new Set([
  "AC", "CP", "DG", "EA", "EU", "EZ",
  "IC", "QO", "TA", "UN", "XA", "XB",
  "XK", "ZZ"
]);

const countryOptions = [];

for (let a = 65; a <= 90; a++) {
  for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b);

    try {
      const name = countryNames.of(code);

      if (
        name &&
        name !== code && !excludedRegionCodes.has(code) &&
        !name.toLowerCase().includes("región desconocida")
      ) {
        countryOptions.push([code, name]);
      }
    } catch {
      // Codigo no reconocido.
    }
  }
}

countryOptions.sort((a, b) =>
  a[1].localeCompare(b[1], "es")
);

const currencyOptions = [
  ["ARS", "Peso argentino"],
  ["BRL", "Real brasileño"],
  ["CLP", "Peso chileno"],
  ["COP", "Peso colombiano"],
  ["MXN", "Peso mexicano"],
  ["PEN", "Sol peruano"],
  ["USD", "Dólar estadounidense"],
  ["CAD", "Dólar canadiense"],
  ["GBP", "Libra esterlina"],
  ["EUR", "Euro"],
  ["AUD", "Dólar australiano"],
  ["JPY", "Yen japonés"]
];

function addOptions(select, options) {
  for (const [value, label] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${label} (${value})`;
    select.appendChild(option);
  }
}

addOptions(country, countryOptions);
addOptions(currency, currencyOptions);
let requestNumber = 0;
let currentSchema = null;
let schemaSelection = null;
let saving = false;

const form = document.getElementById("bankForm");
const saveButton = form?.querySelector('button[type="submit"]');
if (saveButton) saveButton.disabled = true;

async function submitBankDetails(event) {
  event.preventDefault();

  if (saving) return; if (!schemaSelection || schemaSelection !== [country.value, currency.value, entityType.value, transferMethod.value].join("|")) { message.textContent = "Los datos bancarios cambiaron. Esperá a que se actualicen los requisitos."; return; } if (!currentSchema || !form || !["LOCAL", "SWIFT"].includes(transferMethod.value) || transferMethod.disabled) { message.textContent = "Esperá a que se carguen los requisitos bancarios."; return; }

  const allowedFields = new Set([
    "bank_country_code",
    "account_currency",
    "account_name",
    ...currentSchema.fields.map(field => field.key)
  ]);

  const data = {};

  for (const control of form.querySelectorAll("[name]")) {
    if (!control.name || control.disabled) continue;

    if (!allowedFields.has(control.name)) continue;

    const value = String(control.value ?? "").trim();

    if (control.required && !value) {
      message.textContent = "Completá todos los campos obligatorios.";
      control.focus();
      return;
    }

    if (value) {
      data[control.name] = value;
    }
  }

  for (const control of form.querySelectorAll("[data-airwallex-pattern]")) {
    const pattern = control.dataset.airwallexPattern;
    const value = String(control.value ?? "").trim();

    if (!pattern || !value) continue;

    let valid = false;

    try {
      valid = new RegExp(pattern).test(value);
    } catch {
      message.textContent = "Regla bancaria no válida. Contactá a soporte.";
      return;
    }

    if (!valid) {
      message.textContent = "Revisá el formato del campo bancario indicado.";
      control.focus();
      return;
    }
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  data.type = "BANK_ACCOUNT"; data.entity_type = entityType.value; data.transfer_method = transferMethod.value;

  const schemaInput = {
    bankCountryCode: country.value,
    accountCurrency: currency.value,
    entityType: entityType.value,
    transferMethod: transferMethod.value
  };

  // SEGURIDAD: mantener false hasta autorización expresa.
  const onboardingEnabled = true;

  if (!onboardingEnabled) {
    message.textContent =
      "El registro bancario todavía no está habilitado.";
    return;
  }

  saving = true;
  if (saveButton) saveButton.disabled = true;

  try {
    const result = await submitGuideBankOnboarding(schemaInput, data);

    if (result?.ok === true) {
      message.textContent = result.demo === true ? "Simulación completada. No se guardaron datos bancarios." : "Datos bancarios registrados correctamente.";
    }
  } catch {
    message.textContent =
      "No se pudo completar el registro bancario. Contactá a soporte.";
  } finally {
    saving = false;
    if (saveButton) saveButton.disabled = !currentSchema || !schemaSelection || schemaSelection !== [country.value, currency.value, entityType.value, transferMethod.value].join("|");
  }
}

form?.addEventListener("submit", submitBankDetails);

let discoveryRequestNumber = 0;

async function discoverAvailableMethods() {
  const discoveryId = ++discoveryRequestNumber;

  ++requestNumber;
  currentSchema = null;
  if (saveButton) saveButton.disabled = true;
  schemaSelection = null;
  container.hidden = true;
  container.replaceChildren();
  const methods = ["LOCAL", "SWIFT"];
  const available = [];

  transferMethod.disabled = true;
  transferMethod.replaceChildren(new Option("Consultando métodos...", ""));

  if (!country.value || !currency.value || !entityType.value) {
    transferMethod.replaceChildren(new Option("Seleccioná país, moneda y titular", ""));
    return;
  }

  for (const method of methods) {
    if (discoveryId !== discoveryRequestNumber) return;

    try {
      const schema = await loadGuideBankSchema({
        bankCountryCode: country.value,
        accountCurrency: currency.value,
        entityType: entityType.value,
        transferMethod: method
      });

      if (Array.isArray(schema?.fields)) {
        available.push(method);
      }
      } catch (error) {
        console.warn("BANK_METHOD_DISCOVERY_FAILED", {
          method,
          code: error?.code || error?.message || "UNKNOWN"
        });
        // Metodo no confirmado: no ofrecerlo.
      }
  }

  if (discoveryId !== discoveryRequestNumber) return;

  transferMethod.replaceChildren(new Option("Seleccionar método", ""));

  for (const method of available) {
    transferMethod.add(new Option(
      method === "LOCAL" ? "Transferencia local" : "Transferencia SWIFT",
      method
    ));
  }

  transferMethod.disabled = available.length === 0;

  if (available.length >= 1) {
    transferMethod.value = available.includes("LOCAL") ? "LOCAL" : available[0];
    message.textContent = "Preparando los datos bancarios...";
    await refreshBankFields();
    return;
  }

  if (available.length === 0) {
    message.textContent =
      "No se confirmó un método bancario para esta combinación.";
  } else {
    message.textContent = "Seleccioná un método de transferencia disponible.";
  }
}
async function refreshBankFields() {
  const currentRequest = ++requestNumber;
  currentSchema = null;
  if (saveButton) saveButton.disabled = true;
  schemaSelection = null;

  container.hidden = true;
  container.replaceChildren();

  if (!country.value || !currency.value) {
    message.textContent = "Seleccioná país y moneda.";
    return;
  }

  try {
    getAuthenticatedGuideToken();
  } catch {
    message.textContent = "Iniciá sesión para consultar los requisitos bancarios.";
    return;
  }

  message.textContent = "Consultando requisitos bancarios...";

  try {
    const schema = await loadGuideBankSchema({
      bankCountryCode: country.value,
      accountCurrency: currency.value,
      entityType: entityType.value,
      transferMethod: transferMethod.value
    });

    if (currentRequest !== requestNumber || !["LOCAL", "SWIFT"].includes(transferMethod.value) || transferMethod.disabled) return;

    renderGuideBankFields(schema, container);
    currentSchema = schema;
    schemaSelection = [country.value, currency.value, entityType.value, transferMethod.value].join("|");
    container.hidden = false;
    if (saveButton) saveButton.disabled = false;
    message.textContent = "Requisitos bancarios cargados.";
  } catch {
    if (currentRequest !== requestNumber || !["LOCAL", "SWIFT"].includes(transferMethod.value) || transferMethod.disabled) return;

    message.textContent =
      "No se pudieron consultar los requisitos bancarios.";
  }
}

country.addEventListener("change", discoverAvailableMethods);
currency.addEventListener("change", discoverAvailableMethods);


















entityType.addEventListener("change", discoverAvailableMethods);
transferMethod.addEventListener("change", refreshBankFields);