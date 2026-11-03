import test from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import Booking from "../../../src/models/Booking.js";

process.env.STRIPE_SECRET_KEY = "sk_test_SIMULATED_ONLY";

const { default: router } = await import(
  "../../../src/routes/payments.routes.js"
);

const route = router.stack.find(
  x => x.route?.path === "/create-intent"
);

assert.ok(route, "CREATE_INTENT_NOT_FOUND");

const handler = route.route.stack[1].handle;

test("Controlador real disponible para pruebas aisladas", () => {
  assert.equal(typeof handler, "function");
});
test("Dos solicitudes reales: solo una crea PaymentIntent", async () => {
  const originalFind = Booking.findById;
  const originalUpdate = Booking.findOneAndUpdate;

  const stripe = new Stripe("sk_test_SIMULATED_ONLY");
  const proto = Object.getPrototypeOf(stripe.paymentIntents);
  const originalCreate = proto.create;

  let locked = false;
  let stripeCreates = 0;

  const booking = {
    _id: "507f1f77bcf86cd799439011",
    status: "PENDING",
    paidAt: null,
    travelerEmail: "test@example.com",
    amountCents: 100,
    stripePaymentIntentId: ""
  };

  try {
    Booking.findById = () => ({ then: (resolve, reject) => Promise.resolve({ ...booking }).then(resolve, reject), lean: async () => ({ ...booking }) });

    Booking.findOneAndUpdate = async (filter, update) => {
      if (!locked) {
        locked = true;
        return { ...booking, ...update.$set };
      }
      if (filter.paymentIntentCreationLock && update.$set.stripePaymentIntentId) {
        return { ...booking, amountUsd: 1 };
      }
      return null;
    };

    proto.create = async () => {
      stripeCreates++;
      return { id: "pi_SIMULADO", client_secret: "secret_SIMULADO" };
    };

    const request = () => {
      const req = {
        body: { bookingId: booking._id },
        user: { email: "test@example.com" }
      };
      return new Promise((resolve, reject) => {
        const res = {
          code: 200,
          status(n) { this.code = n; return this; },
          json(data) { resolve({ code: this.code, data }); return this; }
        };
        Promise.resolve(handler(req, res)).catch(reject);
      });
    };

    const results = await Promise.all([request(), request()]);
    assert.deepEqual(results.map(x => x.code).sort(), [200, 409]);
    assert.equal(stripeCreates, 1);
  } finally {
    Booking.findById = originalFind;
    Booking.findOneAndUpdate = originalUpdate;
    proto.create = originalCreate;
  }
});
test("Fallo Mongo despues de Stripe: no se libera el bloqueo", async () => {
  const originalFind = Booking.findById;
  const originalUpdate = Booking.findOneAndUpdate;
  const stripe = new Stripe("sk_test_SIMULATED_ONLY");
  const proto = Object.getPrototypeOf(stripe.paymentIntents);
  const originalCreate = proto.create;

  let lock = null;
  let creates = 0;
  let updates = 0;

  const booking = {
    _id: "507f1f77bcf86cd799439011",
    status: "PENDING",
    paidAt: null,
    travelerEmail: "test@example.com",
    amountCents: 100,
    stripePaymentIntentId: ""
  };

  try {
    Booking.findById = () => ({ then: (resolve, reject) => Promise.resolve({ ...booking }).then(resolve, reject), lean: async () => ({ ...booking }) });

    Booking.findOneAndUpdate = async (filter, update) => {
      updates++;
      if (updates === 1) {
        lock = update.$set.paymentIntentCreationLock;
        return { ...booking, paymentIntentCreationLock: lock, paymentIntentCreationLock: `iguideu-booking-${booking._id}` };
      }
      throw new Error("SIMULATED_MONGO_FAILURE");
    };

    proto.create = async () => {
      creates++;
      return {
        id: "pi_SIMULADO",
        client_secret: "secret_SIMULADO"
      };
    };

    const req = {
      body: { bookingId: booking._id },
      user: { email: "test@example.com" }
    };

    let response;
    const res = {
      code: 200,
      status(n) { this.code = n; return this; },
      json(data) {
        response = { code: this.code, data };
        return this;
      }
    };

    await handler(req, res);

    assert.equal(creates, 1);
    assert.equal(response.code, 500);
    assert.equal(response.data.error, "CREATE_INTENT_ERROR");
    assert.ok(lock, "El bloqueo debe permanecer");
  } finally {
    Booking.findById = originalFind;
    Booking.findOneAndUpdate = originalUpdate;
    proto.create = originalCreate;
  }
});
