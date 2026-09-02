const test = require("node:test");
const assert = require("node:assert/strict");

const TokenBucket = require("./tokenBucket");

/**
 * The clock is injected, so none of this waits on real time — a rate limiter
 * tested with sleeps is a slow test suite and a flaky one.
 */
function at(capacity, refillPerSecond) {
  const clock = { ms: 0 };
  const bucket = new TokenBucket({
    capacity,
    refillPerSecond,
    now: () => clock.ms,
  });
  return { bucket, advance: (ms) => (clock.ms += ms) };
}

test("a fresh key may burst up to capacity, then is refused", () => {
  const { bucket } = at(3, 1);

  assert.equal(bucket.take("a").allowed, true);
  assert.equal(bucket.take("a").allowed, true);
  assert.equal(bucket.take("a").allowed, true);
  assert.equal(bucket.take("a").allowed, false);
});

test("tokens come back at the refill rate", () => {
  const { bucket, advance } = at(3, 1);
  for (let i = 0; i < 3; i += 1) bucket.take("a");

  advance(999);
  assert.equal(bucket.take("a").allowed, false, "not quite a token yet");

  advance(1);
  assert.equal(bucket.take("a").allowed, true, "one second buys one token");
});

test("refill stops at capacity — an idle key banks nothing extra", () => {
  const { bucket, advance } = at(3, 1);
  advance(60_000);

  assert.equal(bucket.peek("a"), 3);
  for (let i = 0; i < 3; i += 1) assert.equal(bucket.take("a").allowed, true);
  assert.equal(bucket.take("a").allowed, false);
});

test("retryAfterMs says exactly how long to wait", () => {
  const { bucket, advance } = at(2, 1);
  bucket.take("a");
  bucket.take("a");

  const refused = bucket.take("a");
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfterMs, 1000);

  advance(refused.retryAfterMs);
  assert.equal(bucket.take("a").allowed, true);
});

test("being refused does not push the refill back", () => {
  // Hammering while empty must not hold the bucket empty — otherwise a client
  // that retries fast is punished longer than one that waits quietly.
  const { bucket, advance } = at(1, 1);
  bucket.take("a");

  advance(500);
  for (let i = 0; i < 20; i += 1) assert.equal(bucket.take("a").allowed, false);

  advance(500);
  assert.equal(bucket.take("a").allowed, true, "still exactly one second");
});

test("keys are independent", () => {
  const { bucket } = at(1, 1);

  assert.equal(bucket.take("a").allowed, true);
  assert.equal(bucket.take("a").allowed, false);
  assert.equal(bucket.take("b").allowed, true, "b has its own bucket");
});

test("peek reports without spending", () => {
  const { bucket } = at(5, 1);

  assert.equal(bucket.peek("a"), 5);
  assert.equal(bucket.peek("a"), 5);
  bucket.take("a");
  assert.equal(bucket.peek("a"), 4);
});

test("reset puts a key back to full", () => {
  const { bucket } = at(2, 1);
  bucket.take("a");
  bucket.take("a");
  assert.equal(bucket.take("a").allowed, false);

  bucket.reset("a");
  assert.equal(bucket.take("a").allowed, true);
});

test("sweep forgets keys that have refilled, and keeps ones that have not", () => {
  const { bucket, advance } = at(2, 1);
  bucket.take("spent");
  bucket.take("spent");

  advance(1000);
  bucket.take("recent");

  // "spent" emptied 1s ago and needs 2s to refill, so it is still meaningful.
  bucket.sweep();
  assert.equal(bucket.size, 2);

  // Two more seconds and both have filled completely; neither carries
  // information any more, so neither is worth the memory.
  advance(2000);
  bucket.sweep();
  assert.equal(bucket.size, 0);
});

test("a swept key behaves exactly like a new one", () => {
  const { bucket, advance } = at(2, 1);
  bucket.take("a");
  advance(10_000);
  bucket.sweep();

  assert.equal(bucket.peek("a"), 2);
});

test("the sustained rate holds over a long run", () => {
  // 60 per minute, requested once a second for five minutes: every one should
  // be allowed, and none should be banked beyond capacity.
  const { bucket, advance } = at(60, 1);
  let allowed = 0;

  for (let i = 0; i < 300; i += 1) {
    if (bucket.take("a").allowed) allowed += 1;
    advance(1000);
  }

  assert.equal(allowed, 300);
});

test("a flood is cut to the sustained rate once the burst is spent", () => {
  // 10 burst, 1/s refill. Ten requests a second for ten seconds is 100
  // attempts; only the burst plus one per second should get through.
  const { bucket, advance } = at(10, 1);
  let allowed = 0;

  for (let second = 0; second < 10; second += 1) {
    for (let i = 0; i < 10; i += 1) {
      if (bucket.take("a").allowed) allowed += 1;
    }
    advance(1000);
  }

  assert.equal(allowed, 10 + 9, "the initial burst, then one per elapsed second");
});

test("rejects a nonsensical configuration rather than limiting nothing", () => {
  assert.throws(() => new TokenBucket({ capacity: 0, refillPerSecond: 1 }), /capacity/);
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerSecond: 0 }), /refillPerSecond/);
});
