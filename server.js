// ==================================================
// 🔥 RUTA ADMIN – SEED DEFINITIVO DE GUÍAS (OFICIAL/INDEPENDENT)
// ==================================================
app.post("/api/admin/seed-guides", async (req, res) => {
  try {
    const adminKey = req.header("x-admin-key");
    if (adminKey !== "ClaveUltraSecreta2025") {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    console.log("[ADMIN] Ejecutando seed definitivo de guías...");

    const docs = [
      {
        id: "arun-bangkok",
        name: "Arun – Bangkok Local Guide",
        city: "Bangkok",
        country: "Tailandia",
        rating: 4.8,
        priceHour: 18,
        priceDay: 110,
        hourlyRate: 18,
        dailyRate: 110,
        languages: ["English", "Thai"],
        description: "Templos · Street food · Mercados nocturnos",
        guideType: "INDEPENDENT",
        identityVerified: true,
        verificationProvider: "manual",
        verificationAt: new Date()
      },
      {
        id: "maya-kathmandu",
        name: "Maya – Kathmandu Cultural Guide",
        city: "Kathmandu",
        country: "Nepal",
        rating: 5.0,
        priceHour: 15,
        priceDay: 95,
        hourlyRate: 15,
        dailyRate: 95,
        languages: ["English", "Nepali"],
        description:
          "Durbar Square, Boudhanath y experiencia local en el valle.",
        guideType: "OFFICIAL",
        identityVerified: true,
        verificationProvider: "manual",
        verificationAt: new Date()
      },
      {
        id: "sofia-buenosaires",
        name: "Sofía – Experta en Buenos Aires",
        city: "Buenos Aires",
        country: "Argentina",
        rating: 4.9,
        priceHour: 20,
        priceDay: 120,
        hourlyRate: 20,
        dailyRate: 120,
        languages: ["Spanish", "English"],
        description:
          "Recorridos históricos y culturales por Buenos Aires.",
        guideType: "OFFICIAL",
        identityVerified: true,
        verificationProvider: "manual",
        verificationAt: new Date()
      }
    ];

    const deleted = await Guide.deleteMany({});
    const inserted = await Guide.insertMany(
      docs.map((d) => ({
        ...d,
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    );

    console.log(
      `[ADMIN] Seed listo. Borrados: ${deleted.deletedCount}, insertados: ${inserted.length}`
    );

    return res.json({
      ok: true,
      deleted: deleted.deletedCount,
      inserted: inserted.length,
      guides: inserted
    });

  } catch (err) {
    console.error("[ADMIN] Error en seed:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});
