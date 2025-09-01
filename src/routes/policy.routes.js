const express = require('express');
const router = express.Router();

// Importamos la policy de cancelación ya existente
const cancellation = require('../policies/cancellation');

// Nueva policy de conducta del guía
const guideConduct = require('../policies/guideConduct');

// Política pública de cancelación
router.get('/cancellation', (req, res) => {
  // Intentamos usar un método público si existe, si no devolvemos un objeto estándar
  let payload;
  try {
    if (typeof cancellation.public === 'function') {
      payload = cancellation.public();
    } else if (cancellation.publicPolicy) {
      payload = cancellation.publicPolicy;
    } else {
      // Fallback minimal si no hay interfaz pública; NO tocamos la lógica usada por booking.routes
      payload = {
        policy: 'cancellation',
        traveler: {
          windows: [
            { minHours: 48, refundPct: 100, label: '>=48h' },
            { minHours: 12, refundPct: 50, label: '48-12h' },
            { minHours: 0, refundPct: 0, label: '<12h' },
          ],
        },
        guide: {
          windows: [
            { minHours: 48, penaltyPct: 0, label: '>=48h' },
            { minHours: 12, penaltyPct: 20, label: '48-12h' },
            { minHours: 0, penaltyPct: 50, label: '<12h' },
          ],
        },
        forceMajeure: [
          'Accidente o emergencia médica',
          'Fallecimiento de familiar directo',
          'Clima extremo o desastre',
          'Cierre gubernamental o seguridad'
        ],
        note: 'Resumen público; la liquidación real la calcula el backend en /api/bookings',
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error('policy.routes /cancellation error:', e);
    payload = { error: 'policy_read_error' };
  }
  res.json(payload);
});

// Política pública de conducta del guía
router.get('/guide-conduct', (req, res) => {
  let payload;
  try {
    if (typeof guideConduct.public === 'function') {
      payload = guideConduct.public();
    } else if (guideConduct.publicPolicy) {
      payload = guideConduct.publicPolicy;
    } else {
      // Fallback muy simple
      payload = {
        policy: 'guide-conduct',
        principles: [
          'Prioriza la seguridad del cliente; verifica rutas y condiciones.',
          'Evita cobros excesivos por parte de vendedores terceros.',
          'Ofrece siempre la calidad de información que a ti te gustaría recibir.',
          'Eres el primer representante de tu cultura.',
          'Comunicación clara, respeto, puntualidad y cumplimiento.',
        ],
        updatedAt: new Date().toISOString(),
      };
    }
  } catch (e) {
    console.error('policy.routes /guide-conduct error:', e);
    payload = { error: 'policy_read_error' };
  }
  res.json(payload);
});

module.exports = router;
