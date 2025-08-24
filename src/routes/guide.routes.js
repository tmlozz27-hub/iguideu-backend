const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');
const ctrl  = require('../controllers/guide.controller');

// Perfil del guía autenticado
router.get('/me', auth, ctrl.getMe);
router.put('/me', auth, ctrl.upsertMe);

// Listado público de guías
router.get('/', ctrl.listPublic);

module.exports = router;
