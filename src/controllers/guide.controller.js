const GuideProfile = require('../models/GuideProfile');
const User = require('../models/User');

function normalizeLanguages(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : String(input).split(',');
  return arr
    .map(s => String(s).trim().toLowerCase().slice(0, 10))
    .filter(Boolean);
}

// GET /api/guides/me
exports.getMe = async (req, res) => {
  try {
    const profile = await GuideProfile.findOne({ userId: req.userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Perfil de guía no encontrado' });
    return res.json({ profile });
  } catch (err) {
    console.error('getMe error:', err);
    return res.status(500).json({ error: 'Error obteniendo perfil de guía', detail: err.message });
  }
};

// PUT /api/guides/me
exports.upsertMe = async (req, res) => {
  try {
    const {
      pricePerHourUSD,
      languages,
      bio,
      country,
      city,
      avatarUrl,
      isActive
    } = req.body;

    if (pricePerHourUSD == null) {
      return res.status(400).json({ error: 'Falta pricePerHourUSD' });
    }

    const update = {
      userId: req.userId,
      pricePerHourUSD,
    };

    if (languages !== undefined) update.languages = normalizeLanguages(languages);
    if (bio !== undefined)       update.bio = bio;
    if (country !== undefined)   update.country = country;
    if (city !== undefined)      update.city = city;
    if (avatarUrl !== undefined) update.avatarUrl = avatarUrl;
    if (isActive !== undefined)  update.isActive = !!isActive;

    const profile = await GuideProfile.findOneAndUpdate(
      { userId: req.userId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    return res.json({ profile });
  } catch (err) {
    console.error('upsertMe error:', err);
    return res.status(500).json({ error: 'Error guardando perfil de guía', detail: err.message });
  }
};

// GET /api/guides (listado público)
exports.listPublic = async (req, res) => {
  try {
    const { country, city, q, sort = 'recent', page = 1, limit = 10 } = req.query;

    const filter = { isActive: true };
    if (country) filter.country = country;
    if (city)    filter.city    = city;
    if (q)       filter.bio     = { $regex: q, $options: 'i' };

    const sortMap = {
      price:  { pricePerHourUSD: 1 },
      recent: { createdAt: -1 },
      rating: { ratingAvg: -1 }
    };

    const pageNum  = Math.max(parseInt(page)  || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 10, 1), 100);
    const skip     = (pageNum - 1) * limitNum;

    const items = await GuideProfile.find(filter)
      .sort(sortMap[sort] || sortMap.recent)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Adjuntar datos básicos del usuario
    const userIds = items.map(i => i.userId);
    const users = await User.find({ _id: { $in: userIds } }, { name: 1, email: 1 }).lean();
    const userMap = Object.fromEntries(users.map(u => [String(u._id), u]));

    const itemsWithUser = items.map(i => ({
      ...i,
      user: userMap[String(i.userId)] || null
    }));

    const total = await GuideProfile.countDocuments(filter);

    return res.json({
      page: pageNum,
      limit: limitNum,
      total,
      items: itemsWithUser
    });
  } catch (err) {
    console.error('listPublic error:', err);
    return res.status(500).json({ error: 'Error listando guías', detail: err.message });
  }
};

