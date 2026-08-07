/**
 * Express 5 forwards rejected promises to the error handler on its own, but
 * wrapping keeps the intent explicit and stays correct if a handler is ever
 * reused outside a router.
 */
module.exports = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);
