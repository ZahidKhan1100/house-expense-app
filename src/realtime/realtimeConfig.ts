import { API_BASE_URL } from "../config/api";

/**
 * Laravel registers `POST /broadcasting/auth` on the **app root**, not under `/api/v1`.
 * `API_BASE_URL` is usually `…/api/v1`, so we must strip that suffix before appending
 * `/broadcasting/auth`. Wrong URL → private channels never authorize (no realtime).
 */
export function resolveBroadcastingAuthUrl(apiBaseUrl: string): string {
  const trimmed = apiBaseUrl.replace(/\/+$/, "");
  const root = trimmed.replace(/\/api\/v1$/, "");
  return `${root}/broadcasting/auth`;
}

/**
 * NOTE: These should be moved to env-based config for production.
 * For now we keep them centralized and easy to swap.
 */
export const REALTIME = {
  pusher: {
    key: "4686704cc817df9b27c9",
    cluster: "eu",
    authEndpoint: resolveBroadcastingAuthUrl(API_BASE_URL),
  },
  brand: {
    coral: "#FF6A6A",
  },
};

