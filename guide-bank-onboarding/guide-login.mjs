import { loadAuthenticatedGuide } from "./guide-session.mjs";

const form = document.getElementById("loginForm");
const button = document.getElementById("loginButton");
const message = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  button.disabled = true;
  message.textContent = "Verificando acceso...";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      body: JSON.stringify({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value
      })
    });

    const data = await response.json();

    if (!response.ok || data.ok !== true || !data.token) {
      throw new Error("LOGIN_FAILED");
    }

    const status = await loadAuthenticatedGuide(data.token);

    form.reset();
    form.hidden = true;

    message.textContent =
      status === "LINKED"
        ? "Tu cuenta bancaria ya está vinculada."
        : status === "NOT_LINKED"
          ? "Completá tus datos bancarios para continuar."
          : "No pudimos verificar tu perfil bancario.";

  } catch {
    message.textContent =
      "No se pudo verificar el acceso o el perfil del guía.";
  } finally {
    button.disabled = false;
  }
});
