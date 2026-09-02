const { createRemoteJWKSet, jwtVerify } = require("jose");
const env = require("../config/env");
const prisma = require("../lib/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { authFailures } = require("./rateLimit");

// Supabase signs with either a project JWT secret (legacy HS256) or a rotating
// asymmetric key published as JWKS. Resolve once at module load.
const jwks = env.supabaseJwtSecret
  ? null
  : createRemoteJWKSet(new URL(`${env.supabaseUrl}/auth/v1/.well-known/jwks.json`));

const secret = env.supabaseJwtSecret
  ? new TextEncoder().encode(env.supabaseJwtSecret)
  : null;

function readBearer(req) {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

/**
 * Verifies the Supabase access token and guarantees an Orbit user row exists.
 *
 * Provisioning happens here rather than in a database trigger so the rule
 * "every account starts with $100,000" lives in code you can read and change.
 * The insert and the wallet are one transaction — a user without a wallet
 * would break every balance check downstream.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const address = req.ip ?? "unknown";

  /**
   * Refused before any signature is checked, so an address that has already
   * spent its allowance cannot make Orbit do the cryptographic work — which is
   * the expensive half, and the half worth protecting.
   */
  if (env.isProduction && authFailures.peek(address) < 1) {
    throw ApiError.tooManyRequests(
      "Too many failed sign-in attempts. Wait a few minutes and try again.",
    );
  }

  /** Counts one failure against this address, then reports it as normal. */
  const reject = (message) => {
    if (env.isProduction) authFailures.take(address);
    return ApiError.unauthorized(message);
  };

  const token = readBearer(req);
  if (!token) throw reject("Missing access token");

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret ?? jwks, {
      issuer: `${env.supabaseUrl}/auth/v1`,
    }));
  } catch {
    throw reject("Your session has expired. Sign in again.");
  }

  // A valid token clears the record: a user who mistyped their way to a few
  // stale-token 401s should not be carrying that against them afterwards.
  authFailures.reset(address);

  const id = payload.sub;
  const email = payload.email ?? null;
  if (!id) throw reject("Token is missing a subject");

  let user = await prisma.user.findUnique({
    where: { id },
    include: { wallet: true },
  });

  if (!user) {
    if (!email) throw reject("Token is missing an email address");

    // Email signup writes `name`; Google writes `full_name` and usually `name`
    // too, but not dependably. The email prefix is the last resort — better a
    // plain username than a blank one on the dashboard greeting.
    const metadata = payload.user_metadata ?? {};
    const name =
      metadata.name?.trim() || metadata.full_name?.trim() || email.split("@")[0];

    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { id, name, email } });
      await tx.wallet.create({
        data: { userId: created.id, balance: env.startingCash },
      });
      return tx.user.findUnique({ where: { id: created.id }, include: { wallet: true } });
    });
  }

  req.user = user;
  next();
});

module.exports = authenticate;
