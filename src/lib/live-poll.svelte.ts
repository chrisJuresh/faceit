import type { LiveOverview } from './types';

const ACTIVE_MS = 20_000;
const IDLE_MS = 60_000;

/** Keeps the live overview fresh while the tab is visible: every 20s during a match, else every 60s. */
export class LivePoll {
  overview = $state.raw<LiveOverview | null>(null);
  failed = $state(false);
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight = false;

  constructor(initial: LiveOverview | null) {
    this.overview = initial;
  }

  get active() {
    return this.overview?.matches.some((match) => match.phase === 'live' || match.phase === 'setup') ?? false;
  }

  /** Starts polling; returns the cleanup function. */
  start() {
    const schedule = () => {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(tick, this.active ? ACTIVE_MS : IDLE_MS);
    };

    const tick = async () => {
      if (document.hidden || this.#inFlight) return schedule();
      this.#inFlight = true;
      try {
        const response = await fetch('/api/live', { headers: { accept: 'application/json' } });
        if (response.ok) {
          this.overview = (await response.json()) as LiveOverview;
          this.failed = false;
        } else {
          this.failed = true;
        }
      } catch {
        this.failed = true;
      } finally {
        this.#inFlight = false;
      }
      schedule();
    };

    const onVisibility = () => {
      if (!document.hidden) void tick();
    };

    document.addEventListener('visibilitychange', onVisibility);
    schedule();
    return () => {
      clearTimeout(this.#timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }
}
