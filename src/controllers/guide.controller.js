// GET /api/guides/me
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const profile = await GuideProfile.findOne({ userId })
      .populate('userId', 'name email')
      .lean();

    if (!profile) return res.status(404).json({ error: 'Perfil de guía no encontrado' });

    return res.json({ profile });
  } catch (err) {
    console.error('getMyProfile error:', err);
    return res.status(500).json({
      error: 'Error obteniendo perfil de guía',
      detail: err?.message || String(err),
      code: err?.code || null,
      kind: err?.kind || null
    });
  }
};

// PUT /api/guides/me (upsert)
exports.upsertMyProfile = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'No autenticado' });

    const {
      bio,
      languages,
      pricePerHourUSD,
      country,
      city,
      avatarUrl,
      isActive,
    } = req.body || {};

    const normalizeLanguages = input => {
      if (!input) return [];
      if (Array.isArray(input)) return input.map(s => String(s).trim().toLowerCase()).filter(Boolean);
      return String(input).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    };

    const langs = normalizeLanguages(languages);
    const existing = await GuideProfile.findOne({ userId }).lean();
    if (!existing && (pricePerHourUSD == null || Number(pricePerHourUSD) <= 0)) {
      return res.status(400).json({ error: 'Falta pricePerHourUSD' });
    }

    const update = {
      ...(bio != null ? { bio: String(bio) } : {}),
      ...(langs ? { languages: langs } : {}),
      ...(pricePerHourUSD != null ? { pricePerHourUSD: Number(pricePerHourUSD) } : {}),
      ...(country != null ? { country: String(country).toUpperCase() } : {}),
      ...(city != null ? { city: String(city) } : {}),
      ...(avatarUrl != null ? { avatarUrl: String(avatarUrl) } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
    };

    const profile = await GuideProfile.findOneAndUpdate(
      { userId },
      { $set: update, $setOnInsert: { userId } },
      { new: true, upsert: true, runValidators: true }
    ).populate('userId', 'name email');

    return res.json({ profile });
  } catch (err) {
    console.error('upsertMyProfile error:', err);
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Duplicado de perfil de guía', detail: err.message });
    }
    return res.status(500).json({
      error: 'Error guardando perfil de guía',
      detail: err?.message || String(err),
      code: err?.code || null,
      kind: err?.kind || null
    });
  }
};
