const express = require("express");
const app = express();
app.get("/ping", (req,res) => res.json({ pong:true }));
app.listen(3000, "0.0.0.0", () => console.log("🟢 MINI escuchando en 0.0.0.0:3000"));
