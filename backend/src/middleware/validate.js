const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

/**
 * Runs after a route's express-validator chain and converts failures into a
 * 400 listing every field that was wrong, so the client can mark them all at
 * once instead of one per round trip.
 */
module.exports = function validate(req, _res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((issue) => ({
    field: issue.path,
    message: issue.msg,
  }));

  next(ApiError.badRequest("Check the highlighted fields", details));
};
