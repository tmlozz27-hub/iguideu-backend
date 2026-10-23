const LABELS = {
  account_number: "Número de cuenta bancaria",
  account_name: "Nombre del titular",
  bank_name: "Nombre del banco",
  bank_code: "Código del banco",
  branch_code: "Código de sucursal",
  iban: "IBAN de la cuenta",
  swift_code: "Código internacional del banco (SWIFT/BIC)",
  bic: "Código internacional del banco (BIC)",
  routing_number: "Número de ruta bancaria",
  sort_code: "Código bancario",
  clabe: "CLABE bancaria",
  cbu: "CBU bancario",
  personal_id_number: "Número de documento de identidad",
  local_clearing_system: "Sistema bancario local",
  transfer_method: "Forma de transferencia",
  entity_type: "Tipo de titular",
  beneficiary_type: "Tipo de cuenta",
  nickname: "Nombre para identificar la cuenta",
  personal_email: "Correo electrónico del titular",
  bank_country_code: "País del banco",
  account_currency: "Moneda de la cuenta"
};

function friendlyLabel(field) {
  const key = String(field.key || "");
  if (LABELS[key]) return LABELS[key];

  const last = key.split(".").pop();
  if (LABELS[last]) return LABELS[last];

  const raw = String(field.label || field.name || key);
  return raw.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase());
}

export function renderGuideBankFields(schema, container) {
  if (!Array.isArray(schema?.fields) || !container) {
    throw new Error("BANK_SCHEMA_RENDER_INVALID");
  }

  const fragment = document.createDocumentFragment();
  const existingFields = new Set([
    "bank_country_code",
    "account_currency",
    "account_name", "entity_type", "transfer_method"
  ]);

  for (const field of schema.fields) {
    if (existingFields.has(field?.key)) continue;
    if (typeof field?.key !== "string" || !field.key) {
      throw new Error("BANK_SCHEMA_FIELD_INVALID");
    }

    const label = document.createElement("label");
    label.textContent = friendlyLabel(field);

    const pattern = field.rule?.pattern;
    const isEnumPattern =
      typeof pattern === "string" &&
      !pattern.startsWith("^") &&
      !pattern.endsWith("$") &&
      pattern.includes("|");

    const choices = Array.isArray(field.options)
      ? field.options
      : Array.isArray(field.enum)
      ? field.enum
      : isEnumPattern
      ? pattern.split("|").map(x => x.trim()).filter(Boolean)
      : null;

    let control;

    if (choices && choices.length > 0) {
      control = document.createElement("select");
      control.appendChild(new Option("Seleccionar", ""));

      for (const choice of choices) {
        const option = document.createElement("option");

        if (typeof choice === "string") {
          option.value = choice;
          option.textContent = choice;
        } else {
          option.value = String(choice.value ?? "");
          option.textContent = String(choice.label ?? choice.value ?? "");
        }

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

    control.name = field.key;
    control.required = field.required === true;

    label.appendChild(control);
    fragment.appendChild(label);
  }

  container.replaceChildren(fragment);
}
