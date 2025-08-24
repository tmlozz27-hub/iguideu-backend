const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'El email ya está registrado' });

    const user = await User.create({ name, email, password, role });
    const token = signToken(user);
    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Error registrando usuario' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y password son requeridos' });

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

    const token = signToken(user);
    res.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Error en login' });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('me error:', err);
    res.status(500).json({ error: 'Error obteniendo perfil' });
  }
};
