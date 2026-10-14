import express from "express";
import assert from "node:assert/strict";

const app = express();

app.get("/api/guides/me/bank-status", (req, res) => {
  const role = req.headers["x-test-role"];

  if (role !== "guide") {
    return res.status(403).json({
      ok: false,
      error: "GUIDE_ONLY"
    });
  }

  return res.json({
    ok: true,
    bankStatus: "LINKED"
  });
});

const server = app.listen(0, "127.0.0.1");

try {
  await new Promise(resolve => server.once("listening", resolve));

  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/api/guides/me/bank-status`;

  const traveler = await fetch(url, {
    headers: { "x-test-role": "traveler" }
  });

  assert.equal(traveler.status, 403);
  console.log("OK: VIAJERO RECHAZADO HTTP 403");

  const guide = await fetch(url, {
    headers: { "x-test-role": "guide" }
  });

  assert.equal(guide.status, 200);

  const data = await guide.json();
  assert.equal(data.bankStatus, "LINKED");

  console.log("OK: GUIA ACEPTADO HTTP 200");
  console.log("OK: ESTADO BANCARIO LINKED");
  console.log("OK: PRUEBA HTTP LOCAL COMPLETADA");
} finally {
  server.close();
}
