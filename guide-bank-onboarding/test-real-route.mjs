import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import assert from "node:assert/strict";
import bankRoutes from "../src/routes/guide-bank-status.routes.js";

const originalDb = mongoose.connection.db;
const originalSecret = process.env.JWT_ACCESS_SECRET;
const originalFallback = process.env.JWT_SECRET;

const secret = "CLAVE-EXCLUSIVA-PRUEBA-LOCAL-2026";
process.env.JWT_ACCESS_SECRET = secret;

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
            airwallex: {
              beneficiaryId: "BENEFICIARIO-FICTICIO"
            }
          };
        }
      };
    }

    throw new Error("COLECCION_NO_PERMITIDA");
  }
};

const app = express();
app.use("/api/guides", bankRoutes);

const server = app.listen(0, "127.0.0.1");

const makeToken = role => jwt.sign(
  { email: "guia-ficticio@iguideu.test", role, tokenVersion: 0 },
  secret,
  {
    issuer: "iguideu-backend",
    audience: "iguideu-mobile",
    expiresIn: "5m"
  }
);

try {
  await new Promise(resolve => server.once("listening", resolve));

  const url = `http://127.0.0.1:${server.address().port}/api/guides/me/bank-status`;

  const withoutToken = await fetch(url);
  assert.equal(withoutToken.status, 401);
  console.log("OK: SIN TOKEN RECHAZADO 401");

  const traveler = await fetch(url, {
    headers: { Authorization: `Bearer ${makeToken("traveler")}` }
  });
  assert.equal(traveler.status, 403);
  console.log("OK: VIAJERO RECHAZADO 403");

  const guide = await fetch(url, {
    headers: { Authorization: `Bearer ${makeToken("guide")}` }
  });
  assert.equal(guide.status, 200);
  const data = await guide.json();
  assert.deepEqual(data, { ok: true, bankStatus: "LINKED" });
  console.log("OK: GUIA AUTENTICADO 200");
  console.log("OK: CUENTA VINCULADA RECONOCIDA");
  console.log("OK: ENDPOINT VERDADERO PROBADO");
} finally {
  server.close();
  mongoose.connection.db = originalDb;

  if (originalSecret === undefined) {
    delete process.env.JWT_ACCESS_SECRET;
  } else {
    process.env.JWT_ACCESS_SECRET = originalSecret;
  }

  if (originalFallback === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalFallback;
  }
}
