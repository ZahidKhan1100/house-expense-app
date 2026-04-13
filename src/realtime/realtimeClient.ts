import Pusher from "pusher-js/react-native";

import { REALTIME } from "./realtimeConfig";

export type RealtimeContext = {
  token: string;
  userId: number;
  houseId: number | null;
};

export function createPusherClient(ctx: RealtimeContext) {
  const pusher = new Pusher(REALTIME.pusher.key, {
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

  return pusher;
}

