const LABELS = {
  account_number: "Número de cuenta bancaria",
  account_name: "Nombre y apellido del titular",
  bank_name: "Nombre del banco",
  bank_code: "Código del banco",
  branch_code: "Código de sucursal",
  iban: "IBAN",
  swift_code: "Código SWIFT / BIC",
  bic: "Código BIC",
  routing_number: "Número de ruta bancaria",
  sort_code: "Código bancario",
  clabe: "CLABE",
  cbu: "CBU",
  personal_id_number: "Documento o identificación fiscal",
  local_clearing_system: "Red bancaria",
  nickname: "Alias de la cuenta (si corresponde)",
  personal_email: "Correo electrónico",
  country_code: "País",
  bank_country_code: "País del banco",
  street_address: "Dirección",
  city: "Ciudad",
  postcode: "Código postal",
  personal_id_type: "Tipo de identificación",
  beneficiary_type: "Tipo de cuenta",
  type: "Tipo de cuenta"
};

const VALUES = {
  BANK_ACCOUNT: "Cuenta bancaria",
  DIGITAL_WALLET: "Billetera digital",
  INDIVIDUAL_TAX_ID: "Identificación fiscal personal",
  ENTITY_TAX_ID: "Identificación fiscal de empresa",
  PERSONAL: "Persona",
  COMPANY: "Empresa",
  LOCAL: "Transferencia local",
  SWIFT: "Transferencia internacional"
};

const countryNames = new Intl.DisplayNames(["es"], {type:"region"});

function friendlyLabel(field) {
  const key = String(field.key || "");
  const last = key.split(".").pop();
  return LABELS[key] || LABELS[last] ||
    String(field.label || field.name || last)
      .replace(/_/g, " ")
      .replace(/\b\w/g, x => x.toUpperCase());
}

function friendlyValue(value) {
  const v = String(value);
  if (VALUES[v]) return VALUES[v];
  if (/^[A-Z]{2}$/.test(v)) {
    try {
      const name = countryNames.of(v);
      if (name && name !== v) return name;
    } catch {}
  }
  return v.replace(/_/g, " ");
}

export function renderGuideBankFields(schema, container) {
  if (!Array.isArray(schema?.fields) || !container) {
    throw new Error("BANK_SCHEMA_RENDER_INVALID");
  }

  const fragment = document.createDocumentFragment();

  const bankLabel = document.createElement("label");
  bankLabel.textContent = window.guideBankLanguage === "en" ? "Bank name" : "Nombre del banco";
  const bankInput = document.createElement("input");
  bankInput.type = "text";
  bankInput.name = "bank_name";
  bankInput.autocomplete = "organization";
  bankInput.required = true;
  bankLabel.appendChild(bankInput);
  fragment.appendChild(bankLabel);

  // Tipo de cuenta: selector visual, no se envia a Airwallex.
  const accountTypeLabel = document.createElement("label");
  accountTypeLabel.textContent = window.guideBankLanguage === "en"
    ? "Account type"
    : "Tipo de cuenta";

  const accountTypeSelect = document.createElement("select");
  accountTypeSelect.name = "iguideu_account_type";
  accountTypeSelect.disabled = false;

  const accountTypeEnglish = window.guideBankLanguage === "en";
  accountTypeSelect.appendChild(new Option(accountTypeEnglish ? "Select" : "Seleccionar", ""));
  accountTypeSelect.appendChild(new Option(accountTypeEnglish ? "Savings account" : "Caja de ahorro", "SAVINGS"));
  accountTypeSelect.appendChild(new Option(accountTypeEnglish ? "Checking account" : "Cuenta corriente", "CHECKING"));
  accountTypeLabel.appendChild(accountTypeSelect);
  fragment.appendChild(accountTypeLabel);
  const existing = new Set([
    "bank_name",
    "bank_country_code", "account_currency",
    "account_name", "entity_type", "transfer_method"
  ]);

  for (const field of schema.fields) {
    const key = field?.key;
    if (typeof key !== "string" || !key) {
      throw new Error("BANK_SCHEMA_FIELD_INVALID");
    }
    if (existing.has(key) || key === "nickname" || key.split(".").pop() === "bank_name") continue;

    const pattern = field.rule?.pattern;
    const enumPattern = typeof pattern === "string" &&
      !pattern.startsWith("^") &&
      !pattern.endsWith("$") &&
      pattern.includes("|");

    const choices = Array.isArray(field.options) ? field.options :
      Array.isArray(field.enum) ? field.enum :
      enumPattern ? pattern.split("|").map(x => x.trim()).filter(Boolean) :
      null;

    const values = choices?.map(x =>
      typeof x === "string" ? x : String(x.value ?? "")
    );

    const last = key.split(".").pop();

    // Tipo de cuenta: únicamente se admite cuenta bancaria.
    if (last === "type" || last === "beneficiary_type") {
      if (!values || values.includes("BANK_ACCOUNT")) {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = key;
        hidden.value = "BANK_ACCOUNT";
        fragment.appendChild(hidden);
        continue;
      }
      throw new Error("BANK_ACCOUNT_NOT_SUPPORTED");
    }

    // País: usar el país bancario seleccionado por el guía.
    if (last === "country_code") {
      const selected = document.getElementById("bank_country_code")?.value;
      if (selected && (!values || values.includes(selected))) {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = key;
        hidden.value = selected;
        fragment.appendChild(hidden);
        continue;
      }
    }

    if (key === "local_clearing_system") {
      if (values?.length === 1 && values[0]) {
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = key;
        hidden.value = values[0];
        fragment.appendChild(hidden);
      }
      continue;
    }
    const label = document.createElement("label");
    const selectedCountry = document.getElementById("bank_country_code")?.value;
    const fieldName = key.split(".").pop();
    const lang = window.guideBankLanguage === "en" ? "en" : "es";
    const bankIdentifierLabel =
      selectedCountry === "AR" && fieldName === "cbu"
        ? (lang === "en" ? "CBU (22 digits)" : "CBU (22 dígitos)")
        : selectedCountry === "MX" && fieldName === "clabe"
          ? (lang === "en" ? "CLABE (18 digits)" : "CLABE (18 dígitos)")
          : null;
    label.textContent = bankIdentifierLabel || (window.guideBankLanguage === "en"
  ? ({
      account_number: selectedCountry === "AR" ? "CBU (22 digits)" : selectedCountry === "MX" ? "CLABE (18 digits)" : "Bank account number",
      account_name: "Account holder full name",
      bank_name: "Bank name",
      bank_code: "Bank code",
      branch_code: "Branch code",
      iban: "IBAN",
      swift_code: "SWIFT / BIC code",
      bic: "BIC code",
      routing_number: "Routing number",
      sort_code: "Sort code",
      clabe: "CLABE",
      cbu: "CBU",
      personal_id_number: "Identification or tax number",
      personal_email: "Email address",
      street_address: "Street address",
      city: "City",
      postcode: "Postal code",
      personal_id_type: "Identification type"
    }[key.split(".").pop()] || friendlyLabel(field))
  : (fieldName === "account_number" && selectedCountry === "AR" ? "CBU (22 dígitos)" : fieldName === "account_number" && selectedCountry === "MX" ? "CLABE (18 dígitos)" : friendlyLabel(field)));

    let control;
    if (choices?.length) {
      control = document.createElement("select");
      control.appendChild(new Option(window.guideBankLanguage === "en" ? "Select" : "Seleccionar", ""));

      for (const choice of choices) {
        const value = typeof choice === "string" ?
          choice : String(choice.value ?? "");

        const option = document.createElement("option");
        option.value = value;
        option.textContent = friendlyValue(value);
        control.appendChild(option);
      }
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.autocomplete = "off";

      if (typeof pattern === "string" && pattern) {
        control.dataset.airwallexPattern = pattern;
      }
    }

    control.name = key;
    control.required = field.required === true;
    label.appendChild(control);
    fragment.appendChild(label);

    if (fieldName === "account_number") {
      const country = document.getElementById("bank_country_code")?.value;
      const lang = window.guideBankLanguage === "en" ? "en" : "es";
      const labels = {
        AR: ["CBU (22 dígitos)", "CBU (22 digits)"],
        MX: ["CLABE (18 dígitos)", "CLABE (18 digits)"],
        US: ["Routing number", "Routing number"],
        GB: ["Sort code", "Sort code"]
      };
      const identifier = labels[country];

      if (identifier) {
        const note = document.createElement("small");
        note.textContent = lang === "en" ? identifier[1] : identifier[0];
        note.style.display = "block";
        note.style.marginTop = "6px";
        fragment.appendChild(note);
      }
    }
  }

    container.replaceChildren(fragment);
}
