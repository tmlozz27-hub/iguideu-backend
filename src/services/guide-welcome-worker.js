import { randomUUID } from "node:crypto";
import { sendGuideWelcomeEmail } from "./guide-welcome-email.js";
import { sendTravelerWelcomeEmail } from "./traveler-welcome-email.js";

export async function processGuideWelcome(db) {
  const col = db.collection("guide_email_notifications");
  const now = new Date();
  const lockId = randomUUID();

  const job = await col.findOneAndUpdate(
    {
      type: { $in: ["GUIDE_BANK_WELCOME", "TRAVELER_WELCOME"] },
      status: "pending",
      $or: [
        { nextAttemptAt: { $exists: false } },
        { nextAttemptAt: { $lte: now } }
      ]
    },
    {
      $set: {
        status: "processing",
        lockId,
        claimedAt: now
      },
      $inc: { attempts: 1 }
    },
    {
      sort: { createdAt: 1 },
      returnDocument: "after"
    }
  );

  if (!job) return { processed: false };

  let result;

  try {
    result = job.type === "TRAVELER_WELCOME"
      ? await sendTravelerWelcomeEmail(job.email)
      : await sendGuideWelcomeEmail(job.email);
  } catch (error) {
    result = { ok: false, reason: error?.message || "SEND_ERROR" };
  }

  if (result?.ok) {
    await col.updateOne(
      { _id: job._id, lockId, status: "processing" },
      {
        $set: { status: "sent", sentAt: new Date() },
        $unset: {
          lockId: "",
          claimedAt: "",
          nextAttemptAt: "",
          lastError: ""
        }
      }
    );

    return { processed: true, sent: true };
  }

  const attempts = job.attempts || 1;
  const retryMinutes = Math.min(60, 2 ** Math.min(attempts, 6));

  await col.updateOne(
    { _id: job._id, lockId, status: "processing" },
    {
      $set: {
        status: "pending",
        nextAttemptAt: new Date(Date.now() + retryMinutes * 60000),
        lastError: String(result?.reason || "UNKNOWN").slice(0, 300)
      },
      $unset: { lockId: "", claimedAt: "" }
    }
  );

  return { processed: true, sent: false };
}
