import jwt from 'jsonwebtoken';

export function signToken(user) {
  const payload = { sub: user._id.toString(), email: user.email };
  const opts = { expiresIn: process.env.JWT_EXPIRES || '2d' };
  return jwt.sign(payload, process.env.JWT_SECRET || 'super-secret-iguideu', opts);
}

/**
 * Authorization: Bearer <token>
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'missing bearer token' });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'super-secret-iguideu');
    const User = global.models?.User;
    if (!User) return res.status(503).json({ error: 'DB unavailable' });
    const user = await User.findById(payload.sub).lean();
    if (!user) return res.status(401).json({ error: 'invalid token' });
    req.user = { _id: user._id, email: user.email, name: user.name };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'token expired' });
    return res.status(401).json({ error: 'invalid token' });
  }
}
