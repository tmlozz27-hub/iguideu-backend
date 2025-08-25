module.exports = (req, res, next) => {
  const h = req.headers.authorization || "";
  // Formatos válidos en dev:
  //   Authorization: Bearer GUIDE:<idGuia>
  //   Authorization: Bearer TRAVELER:<idViajero>
  const m = h.match(/^Bearer\s+(GUIDE|TRAVELER):([\w-]+)$/i);
  if (!m) return res.status(401).json({ error: 'Auth stub: usa "Bearer GUIDE:<id>" o "Bearer TRAVELER:<id>"' });
  const role = m[1].toLowerCase(); // 'guide' | 'traveler'
  const id = m[2];
  req.user = { role, id };
  next();
};
