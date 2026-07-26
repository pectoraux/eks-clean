/**
 * ============================================================================
 *  Eks-Clean — Job Queue (BullMQ-compatible abstraction)
 * ============================================================================
 *  - Public API mirrors BullMQ: queue.add(name, data, opts), worker.process()
 *  - In this sandbox the transport is in-memory (no Redis). Production should
 *    replace `InMemoryQueue` with a real BullMQ queue using the same interface.
 *  - Jobs persist across requests for the lifetime of the process; this is
 *    enough for dispatch, payout-batching, recert-reminder, etc.
 * ============================================================================
 */

export interface Job<T = unknown> {
  id: string;
  name: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  runAt: Date;
}

export interface Queue<T = unknown> {
  add(name: string, data: T, opts?: { delay?: number; attempts?: number }): Promise<Job<T>>;
  process(handler: (job: Job) => Promise<void>): void;
  size(): number;
}

const queues = new Map<string, InMemoryQueue<unknown>>();

export function getQueue<T = unknown>(name: string): Queue<T> {
  let q = queues.get(name) as InMemoryQueue<T> | undefined;
  if (!q) {
    q = new InMemoryQueue<T>();
    queues.set(name, q as unknown as InMemoryQueue<unknown>);
  }
  return q;
}

class InMemoryQueue<T> implements Queue<T> {
  private jobs: Job<T>[] = [];
  private handler?: (job: Job<T>) => Promise<void>;
  private timer?: NodeJS.Timeout;

  async add(
    name: string,
    data: T,
    opts: { delay?: number; attempts?: number } = {},
  ): Promise<Job<T>> {
    const job: Job<T> = {
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      data,
      attempts: 0,
      maxAttempts: opts.attempts ?? 3,
      createdAt: new Date(),
      runAt: new Date(Date.now() + (opts.delay ?? 0)),
    };
    this.jobs.push(job);
    this.schedule();
    return job;
  }

  process(handler: (job: Job<T>) => Promise<void>): void {
    this.handler = handler;
    this.schedule();
  }

  size(): number {
    return this.jobs.length;
  }

  private schedule() {
    if (this.timer || !this.handler) return;
    this.timer = setTimeout(() => this.tick(), 100);
  }

  private async tick() {
    this.timer = undefined;
    if (!this.handler) return;
    const now = Date.now();
    const due = this.jobs.filter((j) => now >= j.runAt.getTime());
    if (due.length === 0) {
      this.schedule();
      return;
    }
    for (const job of due) {
      this.jobs = this.jobs.filter((j) => j.id !== job.id);
      job.attempts += 1;
      try {
        await this.handler(job);
      } catch (e) {
        console.error(`[queue] job ${job.name} failed (attempt ${job.attempts})`, e);
        if (job.attempts < job.maxAttempts) {
          // Exponential backoff
          job.runAt = new Date(Date.now() + 1000 * 2 ** job.attempts);
          this.jobs.push(job);
        }
      }
    }
    this.schedule();
  }
}

/**
 * Recurring job scheduler (replaces BullMQ's RepeatableJob).
 * Cron-like API: register(name, intervalMs, handler).
 */
const recurring = new Map<string, { interval: NodeJS.Timeout; handler: () => Promise<void> }>();

export function startRecurring(
  name: string,
  intervalMs: number,
  handler: () => Promise<void>,
): void {
  stopRecurring(name);
  recurring.set(name, {
    interval: setInterval(() => {
      handler().catch((e) => console.error(`[recurring:${name}]`, e));
    }, intervalMs),
    handler,
  });
}

export function stopRecurring(name: string): void {
  const r = recurring.get(name);
  if (r) {
    clearInterval(r.interval);
    recurring.delete(name);
  }
}
