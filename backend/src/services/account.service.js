const prisma = require("../lib/prisma");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { lockAccount } = require("./order.service");

/**
 * The two destructive things an account holder can do to their own account.
 *
 * Both take the wallet's write lock before touching anything, for the same
 * reason every fill does: an order placed at the same instant reads the balance
 * and positions it is about to change. Without the lock a reset landing
 * mid-order could commit a wallet of 100,000 alongside a holding the order
 * wrote a moment later, which is an account that owns something it never
 * bought.
 */

/**
 * Back to the starting line: no positions, no history, exactly $100,000.
 *
 * Deletion order follows the foreign keys inward — transactions reference
 * orders, orders and positions reference the user — so nothing is ever orphaned
 * mid-transaction, even though the schema would cascade anyway.
 */
async function resetAccount(userId) {
  return prisma.$transaction(async (tx) => {
    await lockAccount(tx, userId);

    await tx.transaction.deleteMany({ where: { userId } });
    await tx.order.deleteMany({ where: { userId } });
    await tx.portfolio.deleteMany({ where: { userId } });

    const wallet = await tx.wallet.update({
      where: { userId },
      data: { balance: env.startingCash },
    });

    return { balance: wallet.balance.toFixed(2) };
  });
}

/**
 * Removes the Supabase Auth user, so the login itself stops existing.
 *
 * Orbit issues no credentials, so this is the one operation it cannot perform
 * with the caller's own token — deleting a user is an admin action, and the
 * service role key is what grants it. Called over REST rather than through the
 * Supabase client library, since one authenticated DELETE does not justify a
 * dependency.
 */
async function deleteAuthUser(userId) {
  const response = await fetch(`${env.supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: env.supabaseServiceRoleKey,
      authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    },
    // Supabase is normally quick here, but an unbounded fetch would hold the
    // request open indefinitely if it were not.
    signal: AbortSignal.timeout(10_000),
  });

  // 404 means the login is already gone, which is the state this was asking
  // for. Treating it as a failure would strand anyone retrying after a
  // half-finished delete.
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(`Supabase responded ${response.status} ${body}`.trim());
  }
}

/**
 * Removes the account entirely: Orbit's rows first, then the login.
 *
 * The order matters, and it is the opposite of the intuitive one. Deleting the
 * login first would leave Orbit holding a row whose email can never be used
 * again — the address is unique, so the same person signing up afresh would
 * collide with their own deleted account and be locked out. Deleting Orbit's
 * rows first means the worst case is a login with no data behind it, which the
 * next sign-in simply provisions again.
 *
 * So a failure at the second step is reported honestly rather than swallowed:
 * the data really is gone, and the caller is told the login is not.
 */
async function deleteAccount(userId) {
  if (!env.supabaseServiceRoleKey) {
    throw ApiError.serviceUnavailable(
      "Account deletion isn't configured on this deployment. Contact support and your account will be removed by hand.",
    );
  }

  // Cascades from the user row through wallet, positions, orders and
  // transactions, so this is one statement rather than five.
  await prisma.user.delete({ where: { id: userId } });

  try {
    await deleteAuthUser(userId);
  } catch (error) {
    console.error("[orbit] deleted Orbit data but could not delete the auth user", error);
    throw ApiError.badGateway(
      "Your trading data was deleted, but your login could not be removed. Contact support to finish it.",
    );
  }
}

module.exports = { resetAccount, deleteAccount };
