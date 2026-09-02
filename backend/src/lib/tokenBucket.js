/**
 * A token bucket, written here rather than pulled from a package.
 *
 * Every key owns a bucket that refills at a steady rate up to a capacity. A
 * request spends a token; when the bucket is empty the request is refused, and
 * the caller is told how long until the next one is worth making.
 *
 * Chosen over the fixed window it replaces because a fixed window has a seam:
 * a client can spend its whole allowance in the last second of one window and
 * the whole of the next in the first second of the following one, sending
 * double the intended rate across that boundary. A bucket has no boundary. It
 * refills continuously, so the long-run rate is exactly `refillPerSecond`
 * while still forgiving a burst of up to `capacity` after a quiet spell —
 * which is what a person clicking around the app actually looks like.
 *
 * State is per process and in memory. Orbit runs a single instance, and a
 * limiter that forgets everything on restart is a better trade than one that
 * needs Redis on the path of every request. If Orbit is ever scaled out, this
 * becomes per-instance and the limits multiply by the instance count.
 */
class TokenBucket {
  /**
   * @param capacity        most tokens the bucket can hold — the burst size.
   * @param refillPerSecond tokens added per second — the sustained rate.
   * @param now             injectable clock, so tests need no real time.
   */
  constructor({ capacity, refillPerSecond, now = () => Date.now() }) {
    if (!(capacity > 0)) throw new Error("capacity must be greater than zero");
    if (!(refillPerSecond > 0)) throw new Error("refillPerSecond must be greater than zero");

    this.capacity = capacity;
    this.refillPerSecond = refillPerSecond;
    this.now = now;
    this.buckets = new Map();
  }

  /** How long an empty bucket takes to fill completely, in milliseconds. */
  get fullRefillMs() {
    return (this.capacity / this.refillPerSecond) * 1000;
  }

  /** Tokens available to `key` right now, without spending any. */
  peek(key) {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.capacity;

    const elapsed = (this.now() - bucket.updatedAt) / 1000;
    return Math.min(this.capacity, bucket.tokens + elapsed * this.refillPerSecond);
  }

  /**
   * Spend `cost` tokens if they are there.
   *
   * A refused request still writes back the refilled level, so being refused
   * costs nothing — the bucket keeps filling while a client hammers it rather
   * than being held empty by the attempts themselves.
   */
  take(key, cost = 1) {
    const now = this.now();
    const tokens = this.peek(key);

    if (tokens < cost) {
      this.buckets.set(key, { tokens, updatedAt: now });
      const deficit = cost - tokens;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.ceil((deficit / this.refillPerSecond) * 1000),
      };
    }

    const left = tokens - cost;
    this.buckets.set(key, { tokens: left, updatedAt: now });
    return { allowed: true, remaining: Math.floor(left), retryAfterMs: 0 };
  }

  /** Puts a key back to full, e.g. once a client proves it is legitimate. */
  reset(key) {
    this.buckets.delete(key);
  }

  /**
   * Drops keys idle long enough to have refilled completely.
   *
   * A full bucket is indistinguishable from one that never existed, so keeping
   * it only costs memory — and without this the map grows once per address
   * seen and never shrinks, which is a slow leak on a public endpoint.
   */
  sweep() {
    const cutoff = this.now() - this.fullRefillMs;
    for (const [key, bucket] of this.buckets) {
      if (bucket.updatedAt <= cutoff) this.buckets.delete(key);
    }
  }

  /** Keys currently held. Exposed for the sweep's tests and for diagnostics. */
  get size() {
    return this.buckets.size;
  }
}

module.exports = TokenBucket;
