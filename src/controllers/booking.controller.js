exports.cancelBooking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

    const isTraveler = String(booking.traveler) === String(userId);
    const isGuide = String(booking.guide) === String(userId);

    if (!isTraveler && !isGuide) {
      return res.status(403).json({ error: 'No sos parte de esta reserva' });
    }

    if (isTraveler) {
      // viajero: solo puede cancelar PENDING
      if (booking.status !== 'pending') {
        return res.status(400).json({ error: 'El viajero no puede cancelar una reserva ya confirmada' });
      }
    } else if (isGuide) {
      // guía: puede cancelar PENDING o CONFIRMED
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({ error: 'El guía solo puede cancelar reservas pending o confirmed' });
      }
    }

    booking.status = 'cancelled';
    await booking.save();
    return res.json({ booking });
  } catch (err) {
    console.error('cancelBooking error:', err);
    return res.status(500).json({ error: 'No se pudo cancelar la reserva' });
  }
};

