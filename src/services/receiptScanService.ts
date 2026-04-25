import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import { API_BASE_URL } from "../config/api";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { createPausableAbortController } from "../utils/pausableAbortController";

export type ReceiptExtraction = {
  total_amount: number | null;
  currency: string | null;
  merchant_name: string | null;
  date: string | null; // YYYY-MM-DD
  /** AI suggestion; matched client-side to house category names. */
  category_hint: string | null;
};

export async function extractReceiptFromImage(uri: string): Promise<ReceiptExtraction> {
  const token = await AsyncStorage.getItem("token");
  if (!token) {
    throw { message: "Not logged in" };
  }

  // On Android, ImagePicker can return a content:// URI. Fetch multipart upload
  // is more reliable with a file:// URI, so copy into cache when needed.
  let fileUri = uri;
  if (Platform.OS === "android" && uri.startsWith("content://")) {
    const dest = `${FileSystem.cacheDirectory}receipt-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    fileUri = dest;
  }

  // iOS often returns HEIC/HEIF from the library; Laravel only accepts jpg/png/webp.
  // Normalize to JPEG (same pattern as wall photo uploads).
  let uploadUri = fileUri;
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      fileUri,
      [{ resize: { width: 2000 } }],
      { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
    );
    uploadUri = manipulated.uri;
  } catch (e) {
    throw {
      message:
        "Could not read this image. Try another photo or re-save it as JPEG in Photos.",
    };
  }

  const form = new FormData();
  form.append("image", {
    uri: uploadUri,
    name: "receipt.jpg",
    type: "image/jpeg",
  } as any);

  let res: Response;
  try {
    const fetchWithTimeout = async (timeoutMs: number) => {
      const { controller, cleanup } = createPausableAbortController(timeoutMs);
      try {
        return await fetch(`${API_BASE_URL}/receipts/extract`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            // NOTE: Do not set Content-Type for multipart; fetch will set boundary.
          },
          body: form,
        });
      } finally {
        cleanup();
      }
    };

    try {
      // Gemini can take longer; give it breathing room.
      res = await fetchWithTimeout(120000);
    } catch (e) {
      // One retry helps devices that momentarily lose radio after the camera/gallery flow.
      await new Promise((r) => setTimeout(r, 900));
      res = await fetchWithTimeout(120000);
    }
  } catch (e: unknown) {
    const m = String((e as { message?: string })?.message ?? e ?? "").toLowerCase();
    throw {
      message:
        m.includes("network") || m.includes("failed to fetch") || m.includes("aborted")
          ? "Network error. Check your connection and try again."
          : m.includes("timeout")
            ? "Receipt scan timed out. Try again on a stronger connection."
            : "Receipt scan failed",
    };
  }

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (__DEV__) {
      console.warn("[receipt scan] API error", res.status, data);
    }
    const firstField = data?.errors && typeof data.errors === "object"
      ? Object.values(data.errors as Record<string, string[]>)[0]?.[0]
      : null;
    const msg =
      data?.message ||
      data?.error ||
      firstField ||
      "Receipt scan failed";
    throw { message: msg, status: res.status, data };
  }

  if (data?.success !== true) {
    throw { message: data?.message || "Receipt scan failed", data };
  }

  const raw = (data.extraction ?? null) as Partial<ReceiptExtraction> | null;
  if (!raw) {
    return {
      total_amount: null,
      currency: null,
      merchant_name: null,
      date: null,
      category_hint: null,
    };
  }
  return {
    total_amount: raw.total_amount ?? null,
    currency: raw.currency ?? null,
    merchant_name: raw.merchant_name ?? null,
    date: raw.date ?? null,
    category_hint:
      typeof raw.category_hint === "string" && raw.category_hint.trim() !== ""
        ? raw.category_hint.trim()
        : null,
  };
}

