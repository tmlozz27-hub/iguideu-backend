import express from "express";
import path from "node:path";

const app = express();
const PORT = 4177;

const file = path.resolve("guide-bank-onboarding/index.html");

app.get("/", (_req, res) => {
  res.sendFile(file);
});

app.listen(PORT, "127.0.0.1", () => {
  console.log("FORMULARIO LOCAL: http://127.0.0.1:4177");
});
