const env = require("../config/env");
const ApiError = require("../utils/ApiError");

function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

/**
 * One place that turns a thrown error into a response. Messages stay in the
 * interface's voice — they say what happened and what to do, and never leak a
 * stack trace or a Prisma error code to the client.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies handlers by arity
function errorHandler(error, _req, res, _next) {
  const isKnown = error instanceof ApiError;
  const status = isKnown ? error.status : 500;

  if (!isKnown || status >= 500) {
    console.error("[orbit]", error);
  }

  res.status(status).json({
    error: {
      message: isKnown ? error.message : "Something went wrong on our end.",
      ...(isKnown && error.details ? { details: error.details } : {}),
      ...(env.isProduction || isKnown ? {} : { stack: error.stack }),
    },
  });
}

module.exports = { notFound, errorHandler };
