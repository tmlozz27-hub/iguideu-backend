import { Router } from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import { authRequired } from "../middlewares/auth.js";
import { validateBookingCreate } from "../middlewares/validate.js";

const router = Router();

router.get("/", authRequired, async (req, res) => {
  const mine = await Booking.find({ $or: [{ traveler: req.user.id }, { guide: req.user.id }] })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ bookings: mine });
});

router.post("/", authRequired, validateBookingCreate, async (req, res) => {
  const { guide, startAt, endAt, price } = req.body;
  const booking = await Booking.create({
    traveler: new mongoose.Types.ObjectId(req.user.id),
    guide,
    startAt,
    endAt,
    price,
    status: "pending"
  });
  res.status(201).json({ booking });
});

router.patch("/:id/confirm", authRequired, async (req, res) => {
  const id = req.params.id;
  const session = await Booking.startSession();
  await session.withTransaction(async () => {
    const current = await Booking.findById(id).session(session);
    if (!current) return res.status(404).json({ error: "Booking not found" });
    if (current.status === "canceled") return res.status(400).json({ error: "Already canceled" });

    const overlaps = await Booking.find({
      _id: { $ne: current._id },
      guide: current.guide,
      status: "confirmed",
      $or: [
        { startAt: { $lt: current.endAt, $gte: current.startAt } },
        { endAt: { $gt: current.startAt, $lte: current.endAt } },
        { startAt: { $lte: current.startAt }, endAt: { $gte: current.endAt } }
      ]
    }).session(session);

    for (const b of overlaps) {
      b.status = "canceled";
      await b.save({ session });
    }

    current.status = "confirmed";
    await current.save({ session });

    res.json({ booking: current, canceledOverlaps: overlaps.map((b) => b._id) });
  });
  session.endSession();
});

router.patch("/:id/cancel", authRequired, async (req, res) => {
  const b = await Booking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: "Booking not found" });
  if (b.status !== "canceled") {
    b.status = "canceled";
    await b.save();
  }
  res.json({ booking: b });
});

export default router;
