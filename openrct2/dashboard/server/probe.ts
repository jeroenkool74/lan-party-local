import net from 'node:net';
import type { Tracker } from './tracker.ts';

/** TCP connect check, used only to tell "server down" from "telemetry missing". */
export function checkPort(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port });
    const done = (ok: boolean) => { sock.destroy(); resolve(ok); };
    sock.setTimeout(timeoutMs, () => done(false));
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
  });
}

/** Probe the game port only while the plugin is not delivering data. */
export function startProbe(tracker: Tracker, host: string, port: number, everyMs = 15000): NodeJS.Timeout {
  const tick = async () => {
    if (tracker.isLive()) {
      tracker.setGamePortOpen(true);
      return;
    }
    tracker.setGamePortOpen(await checkPort(host, port));
  };
  void tick();
  return setInterval(() => void tick(), everyMs);
}
