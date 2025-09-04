export function dbReady(req, res, next) {
  const ready = (global.mongoose && global.mongoose.connection && global.mongoose.connection.readyState === 1);
  if (!ready) return res.status(503).json({ error: "DB unavailable" });
  next();
}
