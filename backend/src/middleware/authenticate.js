const { createRemoteJWKSet, jwtVerify } = require("jose");
const env = require("../config/env");
const prisma = require("../lib/prisma");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

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
  const token = readBearer(req);
  if (!token) throw ApiError.unauthorized("Missing access token");

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret ?? jwks, {
      issuer: `${env.supabaseUrl}/auth/v1`,
    }));
  } catch {
    throw ApiError.unauthorized("Your session has expired. Sign in again.");
  }

  const id = payload.sub;
  const email = payload.email ?? null;
  if (!id) throw ApiError.unauthorized("Token is missing a subject");

  let user = await prisma.user.findUnique({
    where: { id },
    include: { wallet: true },
  });

  if (!user) {
    if (!email) throw ApiError.unauthorized("Token is missing an email address");

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
