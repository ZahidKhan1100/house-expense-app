import * as PusherModule from "pusher-js";
import "pusher-js/react-native";

import { REALTIME } from "./realtimeConfig";

export type RealtimeContext = {
  token: string;
  userId: number;
  houseId: number | null;
};

/** Metro/Hermes often exposes CJS `exports.Pusher`, not a default export — `new` on the namespace throws "constructor is not callable". */
function getPusherConstructor(): new (key: string, options: object) => unknown {
  const m = PusherModule as Record<string, unknown>;
  const fromDefaultObj =
    m.default &&
    typeof m.default === "object" &&
    typeof (m.default as { Pusher?: unknown }).Pusher === "function"
      ? (m.default as { Pusher: new (...args: unknown[]) => unknown }).Pusher
      : null;

  const cand =
    (typeof m.default === "function" ? m.default : null) ??
    fromDefaultObj ??
    (typeof m.Pusher === "function"
      ? (m.Pusher as new (...args: unknown[]) => unknown)
      : null);

  if (typeof cand !== "function") {
    throw new Error(
      "pusher-js: could not resolve constructor (try clearing Metro cache)",
    );
  }

  return cand as new (key: string, options: object) => unknown;
}

/** Log private-channel auth result — use when debugging Android / LAN dev. */
export function bindChannelDebug(channel: { bind: (ev: string, fn: (a?: unknown) => void) => void }, label: string) {
  channel.bind("pusher:subscription_succeeded", () => {
    if (__DEV__) console.log(`[pusher] subscribed ${label}`);
  });
  channel.bind("pusher:subscription_error", (status: unknown) => {
    console.warn(`[pusher] subscription_error ${label}`, status);
  });
}

export function createPusherClient(ctx: RealtimeContext) {
  const PusherCtor = getPusherConstructor();

  if (__DEV__) {
    console.log("[pusher] authEndpoint:", REALTIME.pusher.authEndpoint);
  }

  const pusher = new PusherCtor(REALTIME.pusher.key, {
    cluster: REALTIME.pusher.cluster,
    forceTLS: true,
    channelAuthorization: {
      endpoint: REALTIME.pusher.authEndpoint,
      transport: "ajax",
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        Accept: "application/json",
      },
    },
  });

  if (__DEV__) {
    pusher.connection.bind("state_change", (s: { previous: string; current: string }) => {
      console.log("[pusher] connection", s.previous, "->", s.current);
    });
    pusher.connection.bind("error", (err: unknown) => {
      console.warn("[pusher] connection error:", err);
    });
  }

  return pusher;
}

