import express from "express";

const app = express();
const HOST = "0.0.0.0";
const PORT = 4020;

app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "OK_TEST_ONLY" });
});

app.listen(PORT, HOST, () => {
  console.log(`TEST SERVER ON -> http://${HOST}:${PORT}`);
});