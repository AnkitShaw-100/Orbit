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

  /**
   * Admin key, needed only to delete a Supabase Auth user when someone deletes
   * their Orbit account. Optional rather than required: everything else works
   * without it, and refusing to boot over a feature most deployments never
   * reach would be the wrong trade. The delete endpoint reports its absence.
   *
   * This key bypasses row-level security entirely. It is read here so it can
   * never reach the browser, and it must never be sent to one.
   */
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || null,

  binanceRestUrl: process.env.BINANCE_REST_URL ?? "https://api.binance.com",
  binanceWsUrl: process.env.BINANCE_WS_URL ?? "wss://stream.binance.com:9443",

  // The browser origins allowed to call the API. Comma separated, so a local
  // setup can list both Vite ports without needing EXTRA_ORIGINS as well.
  clientUrls: (process.env.CLIENT_URL ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Any additional origins allowed to call the API, comma separated.
  extraOrigins: (process.env.EXTRA_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  // Vercel project slug, so branch and pull-request preview URLs are allowed
  // without listing each one. Leave unset to allow only CLIENT_URL.
  vercelProject: process.env.VERCEL_PROJECT ?? null,

  /**
   * How many markets Orbit lists. The set isn't hardcoded — it's the busiest
   * USDT pairs on Binance, discovered at boot, so the list reflects what people
   * actually trade rather than a guess made once.
   *
   * Kept deliberately small: every listed market gets a real logo (see the
   * icon check in marketData.service), and a tight list of coins people
   * recognise beats a long tail of tickers nobody can place.
   */
  symbolLimit: Number(process.env.SYMBOL_LIMIT ?? 25),

  startingCash: "100000.00",
};

module.exports = env;
