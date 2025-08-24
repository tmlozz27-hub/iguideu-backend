// src/routes/availability.routes.js
const express = require('express');
const auth = require('../middleware/auth');
const { create, mine, listByGuide, remove } = require('../controllers/availability.controller');

const router = express.Router();

router.post('/', auth, create);             // crear bloque (yo)
router.get('/me', auth, mine);              // listar mis bloques
router.get('/:guideUserId', listByGuide);   // listar bloques públicos de un guía
router.delete('/:id', auth, remove);        // borrar bloque (yo)

module.exports = router;
