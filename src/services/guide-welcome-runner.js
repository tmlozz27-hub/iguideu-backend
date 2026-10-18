import mongoose from "mongoose";
import { processGuideWelcome } from "./guide-welcome-worker.js";

let running = false;

export async function runGuideWelcomeOnce() {
  if (process.env.GUIDE_WELCOME_EMAILS_ENABLED !== "true") {
    return { enabled: false };
  }

  if (running) {
    return { skipped: "ALREADY_RUNNING" };
  }

  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return { skipped: "MONGO_NOT_CONNECTED" };
  }

  running = true;

  try {
    return await processGuideWelcome(mongoose.connection.db);
  } finally {
    running = false;
  }
}
