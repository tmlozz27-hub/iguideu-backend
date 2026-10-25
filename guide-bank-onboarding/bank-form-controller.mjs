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

const countryCodes =
"AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ " +
"BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
"CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
"DE DJ DK DM DO DZ " +
"EC EE EG EH ER ES ET " +
"FI FJ FK FM FO FR " +
"GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY " +
"HK HM HN HR HT HU " +
"ID IE IL IM IN IO IQ IR IS IT " +
"JE JM JO JP " +
"KE KG KH KI KM KN KP KR KW KY KZ " +
"LA LB LC LI LK LR LS LT LU LV LY " +
"MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ " +
"NA NC NE NF NG NI NL NO NP NR NU NZ " +
"OM " +
"PA PE PF PG PH PK PL PM PN PR PS PT PW PY " +
"QA " +
"RE RO RS RU RW " +
"SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ " +
"TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
"UA UG UM US UY UZ " +
"VA VC VE VG VI VN VU " +
"WF WS " +
"YE YT " +
"ZA ZM ZW";

const countryOptions = countryCodes.split(/\s+/).filter(Boolean).map(code => [
  code,
  countryNames.of(code)
]);
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

function updateBankOptionLanguage() {
  const lang = window.guideBankLanguage === "en" ? "en" : "es";
  const names = new Intl.DisplayNames([lang], { type: "region" });
  const collator = new Intl.Collator(lang);

  const selectedCountry = country.value;
  const selectedCurrency = currency.value;

  const countryEntries = [...country.options].filter(option => option.value);
  countryEntries.forEach(option => {
    option.textContent = `${names.of(option.value)} (${option.value})`;
  });
  countryEntries.sort((a, b) =>
    collator.compare(a.textContent, b.textContent)
  );
  countryEntries.forEach(option => country.appendChild(option));

  const englishCurrencies = {
    ARS: "Argentine peso",
    BRL: "Brazilian real",
    CLP: "Chilean peso",
    COP: "Colombian peso",
    MXN: "Mexican peso",
    PEN: "Peruvian sol",
    USD: "US dollar",
    CAD: "Canadian dollar",
    GBP: "British pound",
    EUR: "Euro",
    AUD: "Australian dollar",
    JPY: "Japanese yen"
  };

  const spanishCurrencies = Object.fromEntries(currencyOptions);

  [...currency.options].forEach(option => {
    if (!option.value) return;
    const label = lang === "en"
      ? englishCurrencies[option.value]
      : spanishCurrencies[option.value];
    if (label) option.textContent = `${label} (${option.value})`;
  });

  country.value = selectedCountry;
  currency.value = selectedCurrency;
}

window.addEventListener("guide-language-change", updateBankOptionLanguage);
updateBankOptionLanguage();
let requestNumber = 0;
let currentSchema = null;
let schemaSelection = null;
let saving = false;

const form = document.getElementById("bankForm");
const saveButton = form?.querySelector('button[type="submit"]');
if (saveButton) saveButton.disabled = true;

async function submitBankDetails(event) {
  event.preventDefault();

  if (saving) return; if (!schemaSelection || schemaSelection !== [country.value, currency.value, entityType.value, transferMethod.value].join("|")) { message.textContent = (window.guideBankLanguage === "en" ? "Bank details changed. Wait for the requirements to update." : "Los datos bancarios cambiaron. Esperá a que se actualicen los requisitos."); return; } if (!currentSchema || !form || !["LOCAL", "SWIFT"].includes(transferMethod.value) || transferMethod.disabled) { message.textContent = (window.guideBankLanguage === "en" ? "Wait for the bank requirements to load." : "Esperá a que se carguen los requisitos bancarios."); return; }

  const allowedFields = new Set(["bank_name",
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
      message.textContent = (window.guideBankLanguage === "en" ? "Complete all required fields." : "Completá todos los campos obligatorios.");
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
      message.textContent = (window.guideBankLanguage === "en" ? "Invalid banking rule. Contact support." : "Regla bancaria no válida. Contactá a soporte.");
      return;
    }

    if (!valid) {
      message.textContent = (window.guideBankLanguage === "en" ? "Check the format of the indicated bank field." : "Revisá el formato del campo bancario indicado.");
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
      (window.guideBankLanguage === "en" ? "Bank registration is not enabled yet." : "El registro bancario todavía no está habilitado.");
    return;
  }

  saving = true;
  if (saveButton) saveButton.disabled = true;

  try {
    const result = await submitGuideBankOnboarding(schemaInput, data);

    if (result?.ok === true) {
      message.textContent = result.demo === true ? (window.guideBankLanguage === "en" ? "Simulation completed. No bank details were saved." : "Simulación completada. No se guardaron datos bancarios.") : (window.guideBankLanguage === "en" ? "Bank details registered successfully." : "Datos bancarios registrados correctamente.");
    }
  } catch (error) {
    const duplicate = error?.code === "BANK_ACCOUNT_ALREADY_REGISTERED";
    message.textContent = duplicate
      ? (window.guideBankLanguage === "en"
          ? "This bank account is already registered by another guide."
          : "Esta cuenta bancaria ya está registrada por otro guía.")
      : (window.guideBankLanguage === "en"
          ? "Bank registration could not be completed. Contact support."
          : "No se pudo completar el registro bancario. Contactá a soporte.");
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
  transferMethod.replaceChildren(new Option((window.guideBankLanguage === "en" ? "Checking methods..." : "Consultando métodos..."), ""));

  if (!country.value || !currency.value || !entityType.value) {
    transferMethod.replaceChildren(new Option((window.guideBankLanguage === "en" ? "Select country, currency and account holder" : "Seleccioná país, moneda y titular"), ""));
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

  transferMethod.replaceChildren(new Option((window.guideBankLanguage === "en" ? "Select method" : "Seleccionar método"), ""));

  for (const method of available) {
    transferMethod.add(new Option(
      method === "LOCAL" ? (window.guideBankLanguage === "en" ? "Local bank transfer" : "Transferencia local") : (window.guideBankLanguage === "en" ? "SWIFT transfer" : "Transferencia SWIFT"),
      method
    ));
  }

  transferMethod.disabled = available.length === 0;

  if (available.length >= 1) {
    transferMethod.value = available.includes("LOCAL") ? "LOCAL" : available[0];
    message.textContent = (window.guideBankLanguage === "en" ? "Preparing bank details..." : "Preparando los datos bancarios...");
    await refreshBankFields();
    return;
  }

  if (available.length === 0) {
    message.textContent =
      (window.guideBankLanguage === "en" ? "No bank transfer method was confirmed for this selection." : "No se confirmó un método bancario para esta combinación.");
  } else {
    message.textContent = (window.guideBankLanguage === "en" ? "Select an available transfer method." : "Seleccioná un método de transferencia disponible.");
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
    message.textContent = (window.guideBankLanguage === "en" ? "Select country and currency." : "Seleccioná país y moneda.");
    return;
  }

  try {
    getAuthenticatedGuideToken();
  } catch {
    message.textContent = (window.guideBankLanguage === "en" ? "Sign in to check the bank requirements." : "Iniciá sesión para consultar los requisitos bancarios.");
    return;
  }

  message.textContent = (window.guideBankLanguage === "en" ? "Checking bank requirements..." : "Consultando requisitos bancarios...");

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
    message.textContent = (window.guideBankLanguage === "en" ? "Bank requirements loaded." : "Requisitos bancarios cargados.");
  } catch {
    if (currentRequest !== requestNumber || !["LOCAL", "SWIFT"].includes(transferMethod.value) || transferMethod.disabled) return;

    message.textContent =
      (window.guideBankLanguage === "en" ? "Bank requirements could not be retrieved." : "No se pudieron consultar los requisitos bancarios.");
  }
}

country.addEventListener("change", discoverAvailableMethods);
currency.addEventListener("change", discoverAvailableMethods);


















entityType.addEventListener("change", discoverAvailableMethods);
transferMethod.addEventListener("change", refreshBankFields);