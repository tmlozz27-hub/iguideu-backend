import { loadGuideBankSchema, submitGuideBankOnboarding } from "./bank-schema.mjs";
import { renderGuideBankFields } from "./bank-dynamic-fields.mjs";
import { getAuthenticatedGuideToken } from "./guide-session.mjs";

const country = document.getElementById("bank_country_code");
const currency = document.getElementById("account_currency");
const container = document.getElementById("airwallexDynamicFields");
const message = document.getElementById("bankSchemaMessage");

const countryOptions = [
  ["AR", "Argentina"],
  ["BR", "Brasil"],
  ["CL", "Chile"],
  ["CO", "Colombia"],
  ["MX", "México"],
  ["PE", "Perú"],
  ["US", "Estados Unidos"],
  ["CA", "Canadá"],
  ["GB", "Reino Unido"],
  ["ES", "España"],
  ["FR", "Francia"],
  ["DE", "Alemania"],
  ["IT", "Italia"],
  ["AU", "Australia"],
  ["JP", "Japón"]
];

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
let saving = false;

const form = document.getElementById("bankForm");
const saveButton = form?.querySelector('button[type="submit"]');

async function submitBankDetails(event) {
  event.preventDefault();

  if (saving) return; if (!currentSchema && country.value && currency.value) await refreshBankFields(); if (!currentSchema || !form) { message.textContent = "No se cargaron los requisitos bancarios. Revisá país, moneda e inicio de sesión."; return; }

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

  const schemaInput = {
    bankCountryCode: country.value,
    accountCurrency: currency.value,
    entityType: "PERSONAL",
    transferMethod: "LOCAL"
  };

  // SEGURIDAD: mantener false hasta autorización expresa.
  const onboardingEnabled = window.location.protocol === "https:" || window.location.hostname === "127.0.0.1";

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
    if (saveButton) saveButton.disabled = false;
  }
}

form?.addEventListener("submit", submitBankDetails);

async function refreshBankFields() {
  const currentRequest = ++requestNumber;
  currentSchema = null;

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
      entityType: "PERSONAL",
      transferMethod: "LOCAL"
    });

    if (currentRequest !== requestNumber) return;

    currentSchema = schema;
    renderGuideBankFields(schema, container);
    container.hidden = false;
    message.textContent = "Requisitos bancarios cargados.";
  } catch {
    if (currentRequest !== requestNumber) return;

    message.textContent =
      "No se pudieron consultar los requisitos bancarios.";
  }
}

country.addEventListener("change", refreshBankFields);
currency.addEventListener("change", refreshBankFields);

















