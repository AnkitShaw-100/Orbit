require("dotenv").config();

/**
 * Reads configuration once and fails loudly at boot rather than at the first
 * request that happens to need a missing value.
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

const env = {
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",

  databaseUrl: required("DATABASE_URL"),

  supabaseUrl: required("SUPABASE_URL"),
  // Blank means the project uses asymmetric keys and we verify via JWKS.
  supabaseJwtSecret: process.env.SUPABASE_JWT_SECRET || null,

  binanceRestUrl: process.env.BINANCE_REST_URL ?? "https://api.binance.com",
  binanceWsUrl: process.env.BINANCE_WS_URL ?? "wss://stream.binance.com:9443",

  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",

  /**
   * How many markets Orbit lists. The set isn't hardcoded — it's the busiest
   * USDT pairs on Binance, discovered at boot, so the list reflects what people
   * actually trade rather than a guess made once.
   */
  symbolLimit: Number(process.env.SYMBOL_LIMIT ?? 100),

  startingCash: "100000.00",
};

module.exports = env;
