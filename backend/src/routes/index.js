const { Router } = require("express");
const { body, param, query } = require("express-validator");

const authenticate = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { readLimiter, orderLimiter, klineLimiter } = require("../middleware/rateLimit");
const asyncHandler = require("../utils/asyncHandler");
const market = require("../services/marketData.service");
const orders = require("../services/order.service");
const portfolio = require("../services/portfolio.service");

const router = Router();

/* ---------------------------------------------------------------- market */
// Public: prices are public data and the landing page reads them signed out.

router.get(
  "/markets",
  readLimiter,
  asyncHandler(async (_req, res) => {
    const snapshot = market.snapshot();
    res.json({
      connected: market.isConnected,
      markets: market.getSymbols().map((symbol) => ({ symbol, ...(snapshot[symbol] ?? {}) })),
    });
  }),
);

router.get(
  "/markets/:symbol/klines",
  klineLimiter,
  param("symbol").isString().trim().toUpperCase(),
  query("interval").optional().isIn(["1m", "5m", "15m", "1h", "4h", "1d", "1w"]),
  query("limit").optional().isInt({ min: 10, max: 500 }).toInt(),
  validate,
  asyncHandler(async (req, res) => {
    const candles = await market.fetchKlines(
      req.params.symbol,
      req.query.interval ?? "1h",
      req.query.limit ?? 120,
    );
    res.json({ symbol: req.params.symbol, candles });
  }),
);

/* ------------------------------------------------------------ protected */
// `authenticate` is attached per route rather than with router.use, so an
// unknown /api path still reaches the not-found handler and returns 404
// instead of a misleading 401.

router.get(
  "/me",
  readLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt,
      },
      wallet: await portfolio.getWallet(req.user.id),
    });
  }),
);

router.get(
  "/wallet",
  readLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await portfolio.getWallet(req.user.id));
  }),
);

router.get(
  "/portfolio",
  readLimiter,
  authenticate,
  asyncHandler(async (req, res) => {
    res.json(await portfolio.getPortfolio(req.user.id));
  }),
);

router.post(
  "/orders",
  orderLimiter,
  authenticate,
  body("symbol").isString().trim().toUpperCase().notEmpty().withMessage("Choose a market"),
  body("side").isIn(["BUY", "SELL"]).withMessage("Side must be BUY or SELL"),
  body("quantity")
    .isFloat({ gt: 0 })
    .withMessage("Enter a quantity greater than zero"),
  body("idempotencyKey").optional().isString().trim().isLength({ min: 8, max: 128 }),
  validate,
  asyncHandler(async (req, res) => {
    const result = await orders.placeOrder({
      userId: req.user.id,
      symbol: req.body.symbol,
      side: req.body.side,
      quantity: req.body.quantity,
      // Header first, since that is where the convention puts it; the body is
      // accepted too so a client that cannot set headers is not shut out.
      idempotencyKey: req.get("Idempotency-Key") ?? req.body.idempotencyKey ?? null,
    });

    // 200 rather than 201 on a replay: nothing was created this time round.
    res.status(result.replayed ? 200 : 201).json({
      order: result.order,
      realizedPnl: result.transaction?.realizedPnl ?? null,
      balance: result.balance.toFixed(2),
      replayed: Boolean(result.replayed),
    });
  }),
);

router.get(
  "/orders",
  readLimiter,
  authenticate,
  query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  query("symbol").optional().isString().trim().toUpperCase(),
  validate,
  asyncHandler(async (req, res) => {
    res.json({ orders: await orders.listOrders(req.user.id, req.query) });
  }),
);

router.get(
  "/transactions",
  readLimiter,
  authenticate,
  query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  validate,
  asyncHandler(async (req, res) => {
    res.json({ transactions: await orders.listTransactions(req.user.id, req.query) });
  }),
);

module.exports = router;
