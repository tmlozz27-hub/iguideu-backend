const express = require('express');
const auth = require('../middleware/auth');
const {
  getMe, upsertMe,
  publicList, publicGet
} = require('../controllers/guide.controller');

const router = express.Router();

// Públicos
router.get('/', publicList);        // lista con filtros
router.get('/:userId', publicGet);  // detalle por userId

// Autenticado (propio perfil guía)
router.get('/me', auth, getMe);
router.put('/me', auth, upsertMe);

module.exports = router;
