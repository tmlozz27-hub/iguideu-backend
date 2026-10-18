import { Resend } from "resend";

export async function sendTravelerWelcomeEmail(email) {
  if (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM) {
    return { ok: false, reason: "EMAIL_NOT_CONFIGURED" };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const text = [
    "Bienvenido a I GUIDE U.",
    "",
    "TU GUIA PERSONAL DE TURISMO",
    "",
    "Tu cuenta de viajero fue creada correctamente.",
    "",
    "En I GUIDE U puedes encontrar guias personales de turismo,",
    "elegir segun tu destino, idioma y preferencias,",
    "reservar experiencias y pagar de forma segura.",
    "",
    "Visita nuestra web: https://www.i-guide-u.com/",
    "",
    "Nunca compartas tu contrasena ni tus datos de pago por correo.",
    "",
    "Equipo I GUIDE U"
  ].join("\n");

  try {
    const result = await resend.emails.send({
      from: process.env.MAIL_FROM,
      to: email,
      replyTo: "tomas@i-guide-u.com",
      subject: "Bienvenido a I GUIDE U",
      text
    });

    return result.error
      ? { ok: false, reason: "EMAIL_PROVIDER_ERROR" }
      : { ok: true };
  } catch {
    return { ok: false, reason: "EMAIL_SEND_FAILED" };
  }
}
