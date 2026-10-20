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
    if (existingFields.has(field?.key)) continue;

    if (typeof field?.key !== "string" || !field.key) {
      throw new Error("BANK_SCHEMA_FIELD_INVALID");
    }

    const label = document.createElement("label");
    label.textContent = field.label || field.name || field.key;

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

      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Seleccionar";
      control.appendChild(empty);

      for (const choice of choices) {
        const option = document.createElement("option");

        if (typeof choice === "string") {
          option.value = choice;
          option.textContent = choice;
        } else {
          option.value = String(choice.value ?? "");
          option.textContent = String(
            choice.label ?? choice.value ?? ""
          );
        }

        control.appendChild(option);
      }
    } else {
      control = document.createElement("input");
      control.type = "text";
      control.autocomplete = "off";

      const pattern = field.rule?.pattern;

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