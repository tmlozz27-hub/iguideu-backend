export async function enqueueGuideWelcome(db, guideId, email) {
  const notifications = db.collection("guide_email_notifications");

  const key = `guide-bank-welcome:${String(guideId)}`;

  await notifications.updateOne(
    { _id: key },
    {
      $setOnInsert: {
        guideId,
        email: String(email).trim().toLowerCase(),
        type: "GUIDE_BANK_WELCOME",
        status: "pending",
        attempts: 0,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  return key;
}
