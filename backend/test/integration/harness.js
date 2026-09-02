const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

/**
 * A real Postgres for the tests that need one.
 *
 * The concurrency and idempotency guarantees in the order engine are the two
 * things about Orbit worth being confident in, and neither can be proved with
 * unit tests: they are properties of `SELECT ... FOR UPDATE` and of a unique
 * index, not of any function. Testing them against a stub would only test the
 * stub. So these run against an actual database, in a throwaway container, at
 * the real default isolation level.
 */

/**
 * Any throwaway Postgres will do.
 *
 * TEST_DATABASE_URL wins when it is set — that covers CI, where the runner
 * already provides a database as a service container, and covers anyone who
 * would rather point at a database they run themselves. Otherwise one is
 * started here and thrown away afterwards. The tests themselves cannot tell
 * the difference; only the setup changes.
 *
 * It refuses to run against a database that is not obviously disposable. These
 * tests create and delete users and wallets, and doing that to the real Orbit
 * database because an environment variable was set in the wrong shell is not a
 * mistake worth leaving available.
 */
/**
 * Makes the tests independent of whatever `.env` happens to hold.
 *
 * Two separate problems, both of which only appear in one environment and so
 * are exactly the kind that get shipped:
 *
 * `config/env` fails loudly on a missing SUPABASE_URL, which is right for a
 * server and wrong for a test run. A developer's machine has a .env and CI does
 * not, so without a placeholder here the suite passes locally and fails on
 * push. The value is never dialled — the only code that would is the admin
 * delete, and no test lets it get that far.
 *
 * The service role key is cleared rather than defaulted, and that one matters:
 * left set, the delete tests would send an admin request to a real Supabase
 * project using a real key. A test suite must not hold live credentials for
 * anything, least of all to run a destructive call against it.
 */
function applyTestConfig() {
  process.env.SUPABASE_URL ??= "https://project.test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "";
}

async function startDatabase() {
  applyTestConfig();

  const provided = process.env.TEST_DATABASE_URL;

  if (provided) {
    const { hostname } = new URL(provided);
    const local = ["localhost", "127.0.0.1", "postgres", "db", "::1"].includes(hostname);
    if (!local && !process.env.ALLOW_REMOTE_TEST_DB) {
      throw new Error(
        `Refusing to run destructive tests against ${hostname}. Point TEST_DATABASE_URL at a ` +
          "disposable database, or set ALLOW_REMOTE_TEST_DB=1 if you are certain.",
      );
    }

    applyUrl(provided);
    migrate();
    return { url: provided, stop: async () => {} };
  }

  // No URL given, so run one here. Required lazily, so the package is only
  // loaded by the path that actually uses it.
  //
  // A real Postgres binary rather than a container: it needs no Docker, no WSL
  // and no administrator rights, which matters because the guarantee under test
  // has to be provable on the machine it was written on. Same server, same
  // isolation level, same locking — only the packaging differs.
  const EmbeddedPostgres = require("embedded-postgres");
  const Postgres = EmbeddedPostgres.default ?? EmbeddedPostgres;

  const port = 5433 + Math.floor(Math.random() * 200);
  const server = new Postgres({
    databaseDir: path.join(os.tmpdir(), `orbit-test-${crypto.randomUUID()}`),
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
  });

  await server.initialise();
  await server.start();
  await server.createDatabase("orbit_test");

  const url = `postgresql://postgres:postgres@localhost:${port}/orbit_test`;

  applyUrl(url);
  migrate();

  return { url, stop: () => server.stop() };
}

/**
 * src/lib/prisma.js reads DATABASE_URL when it is first required, and the
 * Prisma CLI reads DIRECT_URL. Both must be set before anything is loaded.
 */
function applyUrl(url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}

/**
 * The schema comes from the migrations rather than `db push`, so what the tests
 * run against is exactly what production runs against — including the unique
 * index the idempotency guarantee depends on.
 */
function migrate() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: process.env,
    stdio: "pipe",
    shell: process.platform === "win32",
  });
}

/**
 * Replaces the market feed with a fixed price.
 *
 * Node 20 has no stable module mocking, so the fake is written straight into
 * the require cache. It has to happen before order.service is required, which
 * is why loading the engine is this module's job rather than the test's.
 */
function loadEngine({ price }) {
  const marketPath = require.resolve("../../src/services/marketData.service");

  require.cache[marketPath] = {
    id: marketPath,
    filename: marketPath,
    loaded: true,
    exports: {
      getExecutionPrice: () => price,
      // No other symbol is marked, so positions fall back to their entry price
      // — which is all the margin check needs here.
      snapshot: () => ({}),
      isSupported: () => true,
      isConnected: true,
      subscribe: () => () => {},
    },
  };

  return {
    orders: require("../../src/services/order.service"),
    prisma: require("../../src/lib/prisma"),
  };
}

/** A user with a wallet, as `authenticate` would have provisioned them. */
async function seedAccount(prisma, { balance }) {
  const id = crypto.randomUUID();

  await prisma.user.create({
    data: { id, name: "Test Trader", email: `${id}@orbit.test` },
  });
  await prisma.wallet.create({ data: { userId: id, balance } });

  return id;
}

module.exports = { startDatabase, loadEngine, seedAccount };
