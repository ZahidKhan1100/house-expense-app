/** Matches backend `WALL_SNIPPET_TTL_DAYS` (default 2). Photo snippets only. */
export const WALL_SNIPPET_PHOTO_TTL_DAYS = 2;

export const WALL_SNIPPET_PHOTO_RETENTION_SHORT =
  `Photo snippets are removed automatically after ${WALL_SNIPPET_PHOTO_TTL_DAYS} days.`;

export const WALL_SNIPPET_PHOTO_RETENTION_DETAIL =
  `Photos on the Wall (receipts, pics, screenshots) are deleted after ${WALL_SNIPPET_PHOTO_TTL_DAYS} days to save space. Text-only notes and polls stay until someone deletes them.`;
