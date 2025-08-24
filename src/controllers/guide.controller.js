// src/controllers/guide.controller.js
const GuideProfile = require('../models/GuideProfile');

function normalizeLanguages(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(s => String(s).trim().toLowerCase()).filter(Boolean);
  return String(input)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

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
    return res.status(500).json({ error: 'Error obteniendo perfil de guía' });
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

    // Normalizaciones
    const langs = normalizeLanguages(languages);

    // Si no existe aún, exigimos pricePerHourUSD al menos
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
    // E11000 duplicate key suele indicar userId:null u otro duplicado
    if (err && err.code === 11000) {
      return res.status(409).json({ error: 'Duplicado de perfil de guía' });
    }
    return res.status(500).json({ error: 'Error guardando perfil de guía' });
  }
};

// GET /api/guides (listado público con filtros)
exports.listGuides = async (req, res) => {
  try {
    const { country, city, sort = 'price', page = 1, limit = 10, q } = req.query;
    const query = { isActive: true };

    if (country) query.country = String(country).toUpperCase();
    if (city) query.city = String(city);

    if (q) {
      query.$or = [
        { bio: { $regex: q, $options: 'i' } },
        { languages: { $in: [String(q).toLowerCase()] } },
      ];
    }

    const sortObj =
      sort === 'price' ? { pricePerHourUSD: 1 } :
      sort === '-price' ? { pricePerHourUSD: -1 } :
      sort === 'rating' ? { ratingAvg: -1, ratingCount: -1 } :
      { createdAt: -1 };

    const pageNum = Math.max(1, Number(page));
    const lim = Math.min(50, Math.max(1, Number(limit)));

    const [items, total] = await Promise.all([
      GuideProfile.find(query)
        .sort(sortObj)
        .skip((pageNum - 1) * lim)
        .limit(lim)
        .populate('userId', 'name email')
        .lean(),
      GuideProfile.countDocuments(query),
    ]);

    return res.json({ page: pageNum, limit: lim, total, items });
  } catch (err) {
    console.error('listGuides error:', err);
    return res.status(500).json({ error: 'Error listando guías' });
  }
};

