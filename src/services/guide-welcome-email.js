import { Resend } from "resend";

const BANK_URL = "https://api.i-guide-u.com/guia/datos-bancarios";

export async function sendGuideWelcomeEmail(email) {
  if (!process.env.RESEND_API_KEY) {
    return { ok: false, reason: "RESEND_NOT_CONFIGURED" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const text = [
    "Bienvenido a I GUIDE U.",
    "",
    "Tu perfil de guia fue creado correctamente.",
    "",
    "Para recibir tus pagos, configura tu cuenta bancaria:",
    BANK_URL,
    "",
    "Ingresa utilizando tu cuenta de I GUIDE U.",
    "",
    "I GUIDE U cobra una comision del 10%.",
    "El 90% corresponde al guia.",
    "Los pagos al guia son elegibles 48 horas despues de finalizar el servicio, sujetos a las verificaciones correspondientes.",
    "",
    "Nunca envies tus datos bancarios por correo electronico.",
    "",
    "Equipo I GUIDE U"
  ].join("\n");

  try {
    const result = await resend.emails.send({
      from: process.env.MAIL_FROM || "I GUIDE U <onboarding@resend.dev>",
      to: email,
      subject: "Bienvenido a I GUIDE U - Configura tus pagos",
      text
    });

    return result.error
      ? { ok: false, reason: "EMAIL_PROVIDER_ERROR" }
      : { ok: true };
  } catch {
    return { ok: false, reason: "EMAIL_SEND_FAILED" };
  }
}
