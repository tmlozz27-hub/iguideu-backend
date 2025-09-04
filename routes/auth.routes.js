const express = require('express');
const router = express.Router();

// Mock users y tokens simples
const USERS = {
  'tom@example.com': { role: 'traveler', password: 'pass123' },
  'guide1@example.com': { role: 'guide', password: 'pass123' },
};

function makeToken(email) {
  // token bobo (NO para producción)
  return Buffer.from(`${email}|${Date.now()}`).toString('base64');
}

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = USERS[email];
  if (!u || u.password !== password) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  return res.json({ token: makeToken(email), user: { email, role: u.role } });
});

module.exports = router;
