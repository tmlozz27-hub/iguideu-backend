import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import assert from "node:assert/strict";

const originalDb = mongoose.connection.db;
const originalSecret = process.env.JWT_ACCESS_SECRET;
const originalEnv = process.env.AIRWALLEX_ENV;
const originalFlag = process.env.AIRWALLEX_LIVE_BENEFICIARIES_ENABLED;
const secret = "JWT-SOLO-PRUEBA-566";

let server;

try {
  process.env.JWT_ACCESS_SECRET = secret;
  process.env.AIRWALLEX_ENV = "live";
  process.env.AIRWALLEX_LIVE_BENEFICIARIES_ENABLED = "false";

  let alreadyLinked = false;

  mongoose.connection.db = {
    collection(name) {
      if (name === "users") {
        return {
          async findOne() {
            return { tokenVersion: 0 };
          }
        };
      }
      if (name === "guides") {
        return {
          async findOne() {
            return {
              _id: "GUIA-FICTICIO-566",
              email: "guia-566@iguideu.test",
              airwallex: alreadyLinked
                ? { beneficiaryId: "BENEFICIARIO-FICTICIO" }
                : {}
            };
          }
        };
      }
      throw new Error("COLECCION_NO_SIMULADA");
    }
  };

  const { default: guidesRoutes } =
    await import("../src/routes/guides.routes.js");

  const app = express();
  app.use(express.json());
  app.use("/api/guides", guidesRoutes);

  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));

  const url =
    `http://127.0.0.1:${server.address().port}/api/guides/me/airwallex/onboarding`;

  const noToken = await fetch(url, { method: "POST" });
  assert.equal(noToken.status, 401);
  console.log("OK: SIN TOKEN 401");

  const token = jwt.sign(
    {
      email: "guia-566@iguideu.test",
      role: "guide",
      tokenVersion: 0
    },
    secret,
    {
      issuer: "iguideu-backend",
      audience: "iguideu-mobile",
      expiresIn: "5m"
    }
  );

  const send = () => fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      schemaInput: {
        bankCountryCode: "AR",
        accountCurrency: "ARS",
        entityType: "PERSONAL",
        transferMethod: "LOCAL"
      },
      beneficiary: {
        type: "BANK_ACCOUNT"
      }
    })
  });

  alreadyLinked = true;
  const duplicate = await send();
  assert.equal(duplicate.status, 409);
  assert.equal(
    (await duplicate.json()).error,
    "AIRWALLEX_BENEFICIARY_ALREADY_EXISTS"
  );
  console.log("OK: CUENTA DUPLICADA 409");

  alreadyLinked = false;
  const disabled = await send();
  assert.equal(disabled.status, 503);
  assert.equal(
    (await disabled.json()).error,
    "AIRWALLEX_LIVE_BENEFICIARIES_DISABLED"
  );
  console.log("OK: ALTA LIVE BLOQUEADA 503");

  console.log("PASO_566_OK");
} finally {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }

  mongoose.connection.db = originalDb;

  for (const [name, value] of [
    ["JWT_ACCESS_SECRET", originalSecret],
    ["AIRWALLEX_ENV", originalEnv],
    ["AIRWALLEX_LIVE_BENEFICIARIES_ENABLED", originalFlag]
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
