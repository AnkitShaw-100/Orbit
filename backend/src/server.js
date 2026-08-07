const http = require("node:http");

const app = require("./app");
const env = require("./config/env");
const prisma = require("./lib/prisma");
const market = require("./services/marketData.service");
const liquidation = require("./services/liquidation.service");
const attachGateway = require("./websocket/gateway");

const server = http.createServer(app);
const gateway = attachGateway(server);

async function start() {
  // The feed comes up before the port opens, so the first request after a
  // deploy already has prices rather than a 503.
  await market.start();

  // Shorts can run past what an account covers at any moment, so the watcher
  // starts with the feed rather than on first use.
  liquidation.start();

  server.listen(env.port, () => {
    console.log(`[orbit] api listening on :${env.port} (${env.nodeEnv})`);
  });
}

/**
 * Railway replaces containers on every deploy and sends SIGTERM first. Closing
 * the upstream feed, the client sockets and the database pool in order avoids
 * dropping a request mid-flight or leaking a Postgres connection.
 */
async function shutdown(signal) {
  console.log(`[orbit] ${signal} received, shutting down`);

  gateway.close();
  liquidation.stop();
  market.stop();

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((error) => {
  console.error("[orbit] failed to start", error);
  process.exit(1);
});
