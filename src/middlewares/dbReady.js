export function dbReady(req, res, next) {
  if (!global.mongoose || global.mongoose.connection.readyState !== 1 || !global.models) {
    return res.status(503).json({ error: 'DB unavailable' });
  }
  return next();
}
