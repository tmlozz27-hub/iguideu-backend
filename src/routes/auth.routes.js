import express from "express";
import mongoose from "mongoose";

const router = express.Router();

const usersCollection = () => mongoose.connection.db.collection("users");

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        message: "EMAIL_AND_PASSWORD_REQUIRED"
      });
    }

    const user = await usersCollection().findOne({ email });

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "INVALID_CREDENTIALS"
      });
    }

    if (String(user.password || "") !== password) {
      return res.status(401).json({
        ok: false,
        message: "INVALID_CREDENTIALS"
      });
    }

    const token = "DEV_TOKEN_" + Buffer.from(email).toString("base64");

    return res.status(200).json({
      ok: true,
      token,
      user: {
        id: String(user._id),
        name: String(user.name || ""),
        email: String(user.email || ""),
        role: String(user.role || "traveler")
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "LOGIN_ERROR"
    });
  }
});

router.post("/register", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        message: "NAME_EMAIL_PASSWORD_REQUIRED"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        ok: false,
        message: "PASSWORD_MIN_6"
      });
    }

    const exists = await usersCollection().findOne({ email });

    if (exists) {
      return res.status(409).json({
        ok: false,
        message: "EMAIL_ALREADY_EXISTS"
      });
    }

    const now = new Date();

    const doc = {
      name,
      email,
      password,
      role: "traveler",
      createdAt: now,
      updatedAt: now
    };

    const result = await usersCollection().insertOne(doc);

    const token = "DEV_TOKEN_" + Buffer.from(email).toString("base64");

    return res.status(201).json({
      ok: true,
      token,
      user: {
        id: String(result.insertedId),
        name,
        email,
        role: "traveler"
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "REGISTER_ERROR"
    });
  }
});

export default router;