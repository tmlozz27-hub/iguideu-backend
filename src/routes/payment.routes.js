// src/routes/payment.routes.js
const express = require('express');
const auth = require('../middleware/auth');
const { createIntent } = require('../controllers/payment.controller');

const router = express.Router();

router.post('/create-intent', auth, createIntent);

module.exports = router;
