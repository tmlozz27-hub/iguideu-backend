function validatePatternValue(key, value, pattern) {
  if (typeof pattern !== "string" || pattern === "") {
    return;
  }

  const isEnumPattern =
    !pattern.startsWith("^") &&
    !pattern.endsWith("$") &&
    pattern.includes("|");

  if (isEnumPattern) {
    const allowed = pattern
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!allowed.includes(String(value))) {
      throw new Error(
        `AIRWALLEX_BENEFICIARY_FIELD_UNSUPPORTED_${key}`
      );
    }

    return;
  }

  try {
    const regex = new RegExp(pattern);

    if (!regex.test(String(value))) {
      throw new Error(
        `AIRWALLEX_BENEFICIARY_FIELD_PATTERN_MISMATCH_${key}`
      );
    }
  } catch (error) {
    if (
      error?.message ===
      `AIRWALLEX_BENEFICIARY_FIELD_PATTERN_MISMATCH_${key}`
    ) {
      throw error;
    }

    throw new Error(
      `AIRWALLEX_BENEFICIARY_SCHEMA_PATTERN_INVALID_${key}`
    );
  }
}

export function validateAirwallexBeneficiaryDataAgainstSchema(schema, data) {
  if (!schema || !Array.isArray(schema.fields)) {
    throw new Error("AIRWALLEX_SCHEMA_INVALID");
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("AIRWALLEX_BENEFICIARY_DATA_REQUIRED");
  }

  for (const field of schema.fields) {
    const key = field?.key;

    if (typeof key !== "string" || !key) {
      throw new Error("AIRWALLEX_SCHEMA_FIELD_INVALID");
    }

    const value = data[key];

    if (
      field.required === true &&
      (value === undefined || value === null || value === "")
    ) {
      throw new Error(`AIRWALLEX_BENEFICIARY_FIELD_REQUIRED_${key}`);
    }

    if (value === undefined || value === null || value === "") {
      continue;
    }

    validatePatternValue(key, value, field?.rule?.pattern);
  }

  return data;
}
