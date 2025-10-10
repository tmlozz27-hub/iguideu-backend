// src/routes/orders.routes.js
import { Router } from 'express';
import { listOrders, getOrderByIntent, syncOrderByPI } from '../controllers/orders.controller.js';

const router = Router();

router.get('/', listOrders);
router.get('/by-intent/:piid', getOrderByIntent);
router.post('/sync/:piid', syncOrderByPI);

export default router;
