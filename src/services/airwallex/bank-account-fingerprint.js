import { createHmac } from "node:crypto";

export function bankAccountFingerprint(beneficiary) {
  const bank = beneficiary?.bank_details || beneficiary || {};

  const normalize = value =>
    String(value ?? "").replace(/[\s-]/g, "").toUpperCase();

  const country = normalize(bank.bank_country_code);

  if (!country) {
    throw new Error("BANK_ACCOUNT_COUNTRY_REQUIRED");
  }

  let account;
  let bankIdentifier = "";

  if (country === "AR") {
    account = normalize(bank.cbu || bank.account_number);

    if (!/^\d{22}$/.test(account)) {
      throw new Error("BANK_ACCOUNT_IDENTIFIER_INVALID");
    }
  } else if (bank.iban) {
    account = normalize(bank.iban);

    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(account)) {
      throw new Error("BANK_ACCOUNT_IDENTIFIER_INVALID");
    }
  } else if (country === "MX") {
    const clabe = normalize(bank.clabe);
    const accountNumber = normalize(bank.account_number);

    if (clabe && accountNumber && clabe !== accountNumber) {
      throw new Error("BANK_ACCOUNT_IDENTIFIER_CONFLICT");
    }

    account = clabe || accountNumber;

    if (!/^\d{18}$/.test(account)) {
      throw new Error("BANK_ACCOUNT_IDENTIFIER_INVALID");
    }
  } else {
    account = normalize(bank.account_number);

    const identifiers = [
      bank.routing_number,
      bank.bank_code,
      bank.branch_code,
      bank.sort_code,
      bank.bsb_number,
      bank.local_clearing_system
    ].map(normalize);

    if (!account || identifiers.every(value => !value)) {
      throw new Error("BANK_ACCOUNT_IDENTIFIER_INCOMPLETE");
    }

    bankIdentifier = identifiers.join("|");
  }

  const secret = process.env.BANK_ACCOUNT_FINGERPRINT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("BANK_ACCOUNT_FINGERPRINT_SECRET_REQUIRED");
  }

  return createHmac("sha256", secret)
    .update(JSON.stringify([country, bankIdentifier, account]))
    .digest("hex");
}
