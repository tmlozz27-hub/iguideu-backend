import { Router } from "express";
import { createPaymentIntent, paymentsDiag, refundPayment } from "../controllers/payments.controller.js";

const r = Router();

r.get("/diag", paymentsDiag);
r.post("/intent", createPaymentIntent);
r.post("/refund", refundPayment);

export default r;
