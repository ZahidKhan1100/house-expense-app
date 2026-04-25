export type WhatsNewItem = {
  title: string;
  body: string;
};

export type WhatsNewEntry = {
  /** Bump when you want to re-show "What's New" without changing app version. */
  id: string;
  headline: string;
  items: WhatsNewItem[];
};

/**
 * Keep this short and user-facing. This is shown on first launch after updating.
 */
export const WHATS_NEW: WhatsNewEntry = {
  id: "2026-04-feature-roundup-1",
  headline: "Offline expenses, notifications, and the House Wall",
  items: [
    {
      title: "Add expenses even without internet",
      body: "Create bills offline and we’ll sync them automatically when you’re back online.",
    },
    {
      title: "Notifications",
      body: "Get alerts for important house activity so you don’t miss updates.",
    },
    {
      title: "House Wall",
      body: "Post updates and photos, run quick polls, and react — all in one shared feed for your house.",
    },
  ],
};

