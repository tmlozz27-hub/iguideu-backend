export async function enqueueTravelerWelcome(db, userId, email) {
  const notifications = db.collection("guide_email_notifications");

  const key = `traveler-welcome:${String(userId)}`;

  await notifications.updateOne(
    { _id: key },
    {
      $setOnInsert: {
        userId,
        email: String(email).trim().toLowerCase(),
        type: "TRAVELER_WELCOME",
        status: "pending",
        attempts: 0,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  return key;
}
