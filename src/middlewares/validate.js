import { celebrate, Joi, Segments } from "celebrate";

export const validateSignup = celebrate({
  [Segments.BODY]: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(72).required(),
    name: Joi.string().min(2).max(60).required()
  })
});

export const validateLogin = celebrate({
  [Segments.BODY]: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(72).required()
  })
});

export const validateBookingCreate = celebrate({
  [Segments.BODY]: Joi.object({
    guide: Joi.string().required(),
    startAt: Joi.date().iso().required(),
    endAt: Joi.date().iso().greater(Joi.ref("startAt")).required(),
    price: Joi.number().positive().required()
  })
});
