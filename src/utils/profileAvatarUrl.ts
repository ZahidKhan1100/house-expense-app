const KEYS = ["avatar_url", "avatar", "profile_photo_url", "photo_url", "image_url"] as const;

export function profileAvatarUrl(
  p: Record<string, unknown> | null | undefined,
): string | null {
  if (!p || typeof p !== "object") return null;
  for (const k of KEYS) {
    const v = p[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}
