import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const folder = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: "10kb" }));

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};

  if (
    email !== "demo@iguideu.test" ||
    password !== "demo12345"
  ) {
    return res.status(401).json({
      ok: false,
      error: "INVALID_CREDENTIALS"
    });
  }

  return res.json({
    ok: true,
    token: "TOKEN-DEMO-LOCAL"
  });
});

app.get("/api/guides/me/bank-status", (req, res) => {
  if (req.headers.authorization !== "Bearer TOKEN-DEMO-LOCAL") {
    return res.status(401).json({
      ok: false,
      error: "UNAUTHORIZED"
    });
  }

  return res.json({
    ok: true,
    bankStatus: "NOT_LINKED"
  });
});

app.post("/api/guides/me/airwallex/schema", (req, res) => {
  if (req.headers.authorization !== "Bearer TOKEN-DEMO-LOCAL") {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const { bankCountryCode, accountCurrency } = req.body || {};

  if (bankCountryCode !== "AR" || accountCurrency !== "ARS") {
    return res.status(400).json({
      ok: false,
      error: "DEMO_ONLY_AR_ARS"
    });
  }

  return res.json({
    ok: true,
    schema: { fields: [
      {
        key: "account_number",
        label: "CBU (22 dígitos)",
        required: true,
        rule: { pattern: "^[0-9]{22}$" }
      }
    ] }
  });
});
app.post("/api/guides/me/airwallex/onboarding",(req,res)=>{if(req.headers.authorization!=="Bearer TOKEN-DEMO-LOCAL")return res.status(401).json({ok:false,error:"UNAUTHORIZED"});const {schemaInput,beneficiary}=req.body||{};if(schemaInput?.bankCountryCode!=="AR"||schemaInput?.accountCurrency!=="ARS")return res.status(400).json({ok:false,error:"DEMO_ONLY_AR_ARS"});if(!/^[0-9]{22}$/.test(String(beneficiary?.account_number||"")))return res.status(400).json({ok:false,error:"INVALID_CBU"});return res.json({ok:true,demo:true,message:"SIMULACION_COMPLETADA_SIN_GUARDAR_DATOS"});});
app.use(express.static(folder));

app.get("/", (_req, res) => {
  res.sendFile(path.join(folder, "index.html"));
});

app.listen(4178, "127.0.0.1", () => {
  console.log("DEMO I GUIDE U: http://127.0.0.1:4178");
  console.log("USUARIO: demo@iguideu.test");
  console.log("CLAVE: demo12345");
  console.log("SOLO DATOS FICTICIOS - SIN CONEXION A PRODUCCION");
});




