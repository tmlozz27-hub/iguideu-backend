export function renderGuideBankFields(schema, container) {
  if (!Array.isArray(schema?.fields) || !container) {
    throw new Error("BANK_SCHEMA_RENDER_INVALID");
  }

  const fragment = document.createDocumentFragment();

  const existingFields = new Set([
    "bank_country_code",
    "account_currency",
    "account_name"
  ]);

  for (const field of schema.fields) {
    if (existingFields.has(field?.key)) {
      continue;
    }
    if (typeof field?.key !== "string" || !field.key) {
      throw new Error("BANK_SCHEMA_FIELD_INVALID");
    }

    const label = document.createElement("label");
    label.textContent = field.label || field.name || field.key;

    const pattern = field.rule?.pattern;
    const isEnum =
      typeof pattern === "string" &&
      !pattern.startsWith("^") &&
      !pattern.endsWith("$") &&
      pattern.includes("|");

    let control;

    if (isEnum) {
      control = document.createElement("select");

      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Seleccionar";
      control.appendChild(empty);

      for (const value of pattern.split("|").map(x => x.trim()).filter(Boolean)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
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

