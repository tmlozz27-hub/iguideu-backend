// src/middlewares/validate.js
const { ZodError } = require("zod");

function validate(schema, pick = "body") {
  return (req, res, next) => {
    try {
      const data = pick === "query" ? req.query : req.body;
      const parsed = schema.parse(data);
      if (pick === "query") req.validatedQuery = parsed;
      else req.validated = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(400).json({
          error: "validation_error",
          details: err.issues.map((i) => ({ path: i.path, message: i.message })),
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
