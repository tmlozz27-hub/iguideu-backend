const texts = {
  es: {
    title: "Registro bancario para guías",
    intro: "Ingresá con tu cuenta de I GUIDE U para continuar con la configuración de tus pagos.",
    email: "Correo electrónico",
    password: "Contraseña",
    login: "Ingresar",
    showPassword: "Mostrar contraseña",
    hidePassword: "Ocultar contraseña",
    details: "Datos bancarios del guía",
    instructions: "Completá los datos de la cuenta donde querés recibir tus pagos.",
    country: "País donde tenés tu cuenta bancaria",
    selectCountry: "Seleccionar país",
    currency: "Moneda en la que querés recibir tus pagos",
    selectCurrency: "Seleccionar moneda",
    accountName: "Nombre completo del titular de la cuenta",
    entity: "La cuenta pertenece a",
    personal: "Una persona",
    company: "Una empresa",
    transfer: "Forma de recibir el pago",
    local: "Transferencia bancaria local",
    swift: "Transferencia bancaria internacional",
    save: "Guardar mis datos bancarios",
    linked: "Cuenta bancaria vinculada",
    linked1: "Tu cuenta bancaria ya está registrada en I GUIDE U.",
    linked2: "No necesitás volver a ingresar tus datos bancarios.",
    linked3: "Los pagos estarán sujetos a la validación y habilitación del servicio de transferencias.",
    select: "Seleccionar"
  },
  en: {
    title: "Bank account registration for guides",
    intro: "Sign in with your I GUIDE U account to configure your payments.",
    email: "Email address",
    password: "Password",
    login: "Sign in",
    showPassword: "Show password",
    hidePassword: "Hide password",
    details: "Guide bank details",
    instructions: "Enter the bank account where you want to receive payments.",
    country: "Country of your bank account",
    selectCountry: "Select country",
    currency: "Currency in which you want to receive payments",
    selectCurrency: "Select currency",
    accountName: "Full name of the account holder",
    entity: "Account belongs to",
    personal: "An individual",
    company: "A company",
    transfer: "Payment method",
    local: "Local bank transfer",
    swift: "International bank transfer",
    save: "Save my bank details",
    linked: "Linked bank account",
    linked1: "Your bank account is already registered with I GUIDE U.",
    linked2: "You do not need to enter your bank details again.",
    linked3: "Payments are subject to verification and availability of the transfer service.",
    select: "Select"
  }
};

const fields = {
  bank_name: ["Nombre del banco", "Bank name"],
  account_number: ["Número de cuenta bancaria", "Bank account number"],
  bank_code: ["Código del banco", "Bank code"],
  branch_code: ["Código de sucursal", "Branch code"],
  iban: ["IBAN", "IBAN"],
  swift_code: ["Código SWIFT / BIC", "SWIFT / BIC code"],
  bic: ["Código BIC", "BIC code"],
  routing_number: ["Número de ruta bancaria", "Routing number"],
  sort_code: ["Código bancario", "Sort code"],
  clabe: ["CLABE", "CLABE"],
  cbu: ["CBU", "CBU"],
  personal_id_number: ["Documento o identificación fiscal", "Identification or tax number"],
  personal_email: ["Correo electrónico", "Email address"],
  street_address: ["Dirección", "Street address"],
  city: ["Ciudad", "City"],
  postcode: ["Código postal", "Postal code"],
  personal_id_type: ["Tipo de identificación", "Identification type"],
  beneficiary_type: ["Tipo de cuenta", "Account type"],
  local_clearing_system: ["Red bancaria", "Bank clearing system"]
};

function setLabel(id, value) {
  const el = document.querySelector(`label[for="${id}"]`);
  if (el) el.textContent = value;
}

function applyLanguage() {
  const lang = window.guideBankLanguage === "en" ? "en" : "es";
  const t = texts[lang];
  const i = lang === "en" ? 1 : 0;

  document.documentElement.lang = lang;
  document.title = `I GUIDE U | ${t.title}`;

  const main = document.querySelector("main");
  if (!main) return;

  const headings = main.querySelectorAll(":scope > h2");
  if (headings[0]) headings[0].textContent = t.title;

  const intro = main.querySelector(":scope > p");
  if (intro) intro.textContent = t.intro;

  const bank = document.getElementById("bankDetails");
  if (bank) {
    const h = bank.querySelector("h2");
    const p = bank.querySelector("p");
    if (h) h.textContent = t.details;
    if (p) p.textContent = t.instructions;
  }

  const linked = document.getElementById("linkedBank");
  if (linked) {
    const h = linked.querySelector("h2");
    const p = linked.querySelectorAll("p");
    if (h) h.textContent = t.linked;
    [t.linked1, t.linked2, t.linked3].forEach((v, n) => {
      if (p[n]) p[n].textContent = v;
    });
  }

  [
    ["email", t.email],
    ["password", t.password],
    ["bank_country_code", t.country],
    ["account_currency", t.currency],
    ["account_name", t.accountName],
    ["entity_type", t.entity],
    ["transfer_method", t.transfer]
  ].forEach(([id, value]) => setLabel(id, value));

  const login = document.querySelector('#loginForm button[type="submit"]');
  if (login) login.textContent = t.login;

  const save = document.querySelector('#bankForm button[type="submit"]');
  if (save) save.textContent = t.save;

  const eye = document.getElementById("passwordEye");
  if (eye) {
    const password = document.getElementById("password");
    const visible = password && password.type === "text";
    eye.setAttribute("aria-label", visible ? t.hidePassword : t.showPassword);
    eye.title = visible ? t.hidePassword : t.showPassword;
  }

  const setOption = (selectId, value, label) => {
    const option = [...(document.getElementById(selectId)?.options || [])]
      .find(o => o.value === value);
    if (option) option.textContent = label;
  };

  setOption("bank_country_code", "", t.selectCountry);
  setOption("account_currency", "", t.selectCurrency);
  setOption("entity_type", "PERSONAL", t.personal);
  setOption("entity_type", "COMPANY", t.company);
  setOption("transfer_method", "LOCAL", t.local);
  setOption("transfer_method", "SWIFT", t.swift);

  document.querySelectorAll("#airwallexDynamicFields label").forEach(label => {
    const control = label.querySelector("[name]");
    if (!control) return;
    const key = control.name.split(".").pop();
    const country = document.getElementById("bank_country_code")?.value;
    const identifier =
      country === "AR" && key === "cbu"
        ? ["CBU (22 dígitos)", "CBU (22 digits)"]
        : country === "MX" && key === "clabe"
          ? ["CLABE (18 dígitos)", "CLABE (18 digits)"]
          : null;
    const names = identifier || fields[key];
    if (!names) return;
    const node = [...label.childNodes].find(n => n.nodeType === 3);
    if (node && node.textContent !== names[i]) node.textContent = names[i];
  });
}

window.addEventListener("guide-language-change", applyLanguage);

const dynamic = document.getElementById("airwallexDynamicFields");
if (dynamic) {
  new MutationObserver(applyLanguage).observe(dynamic, { childList: true });
}

applyLanguage();