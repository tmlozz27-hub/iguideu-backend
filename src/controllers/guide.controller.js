const GuideProfile = require('../models/GuideProfile');
const User = require('../models/User');

// Normaliza array de lenguajes
function normalizeLanguages(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map(s => s.trim().toLowerCase()).filter(Boolean);
  return String(input)
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

// ---- Perfil del guía autenticado ----
exports.getMe = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });

    const profile = await GuideProfile.findOne({ userId: req.userId });
    if (!profile) return res.status(404).json({ error: 'Perfil de guía no encontrado' });

    return res.json({ profile });
  } catch (err) {
    console.error('guide.getMe error:', err);
    return res.status(500).json({ error: 'No se pudo obtener mi perfil de guía' });
  }
};

exports.upsertMe = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'No autenticado' });

    const {
      bio,
      languages,
      pricePerHourUSD,
      country,
      city,
      avatarUrl,
      isActive,
    } = req.body || {};

    // si no existe y no mandó precio, rechazamos (regla mínima)
    const existing = await GuideProfile.findOne({ userId: req.userId });
    if (!existing && (pricePerHourUSD == null)) {
      return res.status(400).json({ error: 'Falta pricePerHourUSD' });
    }

    const langs = normalizeLanguages(languages);

    const update = {
      ...(bio != null && { bio: String(bio) }),
      ...(languages != null && { languages: langs }),
      ...(pricePerHourUSD != null && { pricePerHourUSD: Number(pricePerHourUSD) }),
      ...(country != null && { country: String(country).toUpperCase() }),
      ...(city != null && { city: String(city) }),
      ...(avatarUrl != null && { avatarUrl: String(avatarUrl) }),
      ...(isActive != null && { isActive: Boolean(isActive) }),
      userId: req.userId,
    };

    const profile = await GuideProfile.findOneAndUpdate(
      { userId: req.userId },
      { $set: update },
      { new: true, upsert: true, runValidators: true }
    );

    return res.json({ profile });
  } catch (err) {
    console.error('guide.upsertMe error:', err);
    return res.status(500).json({ error: 'Error guardando perfil de guía', detail: err });
  }
};

// ---- Públicos: listado / detalle ----

// GET /api/guides -> lista pública con filtros
exports.publicList = async (req, res) => {
  try {
    const {
      country,
      city,
      q,               // texto libre: busca en nombre de User o bio
      langs,           // "es,en" o array
      minPrice,        // mínimo por hora
      maxPrice,        // máximo por hora
      sort = 'price',  // price|rating|recent
      page = '1',
      limit = '20',
    } = req.query;

    const filter = { isActive: true };

    if (country) filter.country = String(country).toUpperCase();
    if (city) filter.city = String(city);

    // lenguajes: contiene todos los solicitados
    const langList = normalizeLanguages(langs);
    if (langList.length) {
      filter.languages = { $all: langList };
    }

    // rango de precio
    const priceCond = {};
    if (minPrice != null) priceCond.$gte = Number(minPrice);
    if (maxPrice != null) priceCond.$lte = Number(maxPrice);
    if (Object.keys(priceCond).length) filter.pricePerHourUSD = priceCond;

    // paginación
    const p = Math.max(1, Number(page) || 1);
    const lim = Math.min(50, Math.max(1, Number(limit) || 20));
    const skip = (p - 1) * lim;

    // orden
    let sortObj = {};
    if (sort === 'price') sortObj = { pricePerHourUSD: 1, _id: -1 };
    else if (sort === 'rating') sortObj = { ratingAvg: -1, ratingCount: -1 };
    else if (sort === 'recent') sortObj = { createdAt: -1 };
    else sortObj = { pricePerHourUSD: 1 };

    // si hay q, necesitamos lookup con user o buscar por bio
    let pipeline = [
      { $match: filter },
      { $sort: sortObj },
    ];

    if (q && String(q).trim().length) {
      const text = String(q).trim();
      // intentaremos filtrar por bio y luego enriquecer con user para nombre
      pipeline.unshift({
        $match: {
          ...filter,
          $or: [
            { bio: { $regex: text, $options: 'i' } },
            // city también por si acaso
            { city: { $regex: text, $options: 'i' } },
          ],
        },
      });
    }

    // total para paginación
    const total = await GuideProfile.countDocuments(pipeline.find(x => x.$match)?.$match || filter);

    // obtener página
    const items = await GuideProfile.find(pipeline.find(x => x.$match)?.$match || filter)
      .sort(sortObj)
      .skip(skip)
      .limit(lim)
      .lean();

    // enriquecer con nombre del user
    const userIds = [...new Set(items.map(it => it.userId))];
    const users = await User.find({ _id: { $in: userIds } })
      .select('_id name email')
      .lean();
    const mapUsers = new Map(users.map(u => [String(u._id), u]));

    const data = items.map(it => ({
      ...it,
      user: mapUsers.get(String(it.userId)) || null,
    }));

    return res.json({
      page: p,
      limit: lim,
      total,
      items: data,
    });
  } catch (err) {
    console.error('guide.publicList error:', err);
    return res.status(500).json({ error: 'No se pudo listar guías' });
  }
};

// GET /api/guides/:userId -> detalle público del guía (su perfil)
exports.publicGet = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'Falta userId' });

    const profile = await GuideProfile.findOne({ userId, isActive: true });
    if (!profile) return res.status(404).json({ error: 'Guía no encontrado' });

    const user = await User.findById(userId).select('_id name email').lean();

    return res.json({ profile, user });
  } catch (err) {
    console.error('guide.publicGet error:', err);
    return res.status(500).json({ error: 'No se pudo obtener guía' });
  }
};

