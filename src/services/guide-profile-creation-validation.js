export async function validateGuideProfileCreation(db, authenticatedEmail, submittedEmail) {
  if (!db) throw new Error("GUIDE_DB_REQUIRED");

  const authEmail = String(authenticatedEmail || "").trim().toLowerCase();
  const bodyEmail = String(submittedEmail || "").trim().toLowerCase();

  if (!authEmail || !bodyEmail || authEmail !== bodyEmail) {
    return { ok: false, status: 403, error: "FORBIDDEN_GUIDE_EMAIL" };
  }

  const user = await db.collection("users").findOne({ email: authEmail });

  if (!user) {
    return { ok: false, status: 401, error: "GUIDE_USER_NOT_FOUND" };
  }

  if (String(user.role || "").toLowerCase() !== "guide") {
    return { ok: false, status: 403, error: "GUIDE_ROLE_REQUIRED" };
  }

  const existing = await db.collection("guides").findOne({ email: authEmail });

  if (existing) {
    return { ok: false, status: 409, error: "GUIDE_PROFILE_ALREADY_EXISTS" };
  }

  return { ok: true, email: authEmail, userId: String(user._id) };
}
