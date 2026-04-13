import { API_BASE_URL } from "../config/api";

/**
 * NOTE: These should be moved to env-based config for production.
 * For now we keep them centralized and easy to swap.
 */
export const REALTIME = {
  pusher: {
    key: "4686704cc817df9b27c9",
    cluster: "eu",
    /**
     * For Laravel this is typically /broadcasting/auth (on same domain as API).
     * Our apiClient already prefixes /api/v1, so use absolute URL here.
     */
    authEndpoint: `${API_BASE_URL}/broadcasting/auth`,
  },
  brand: {
    coral: "#FF6A6A",
  },
  cloudinary: {
    cloudName: "CLOUDINARY_CLOUD_NAME_HERE",
    uploadPreset: "CLOUDINARY_UNSIGNED_PRESET_HERE",
  },
};

