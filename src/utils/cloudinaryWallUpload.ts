import * as ImageManipulator from "expo-image-manipulator";
import { RECEIPT_IMAGE_MAX_DIMENSION } from "../constants/receiptImage";
import { apiClient } from "./apiClient";

export type CloudinaryUploadResult = {
  url: string;
  publicId: string | null;
};

/**
 * Uploads a local image URI via the same Cloudinary preset as House Wall snippets.
 */
export async function uploadImageViaHouseWallSignature(
  uri: string,
  options?: {
    maxWidth?: number;
    compress?: number;
    fileName?: string;
  },
): Promise<CloudinaryUploadResult> {
  const maxWidth = options?.maxWidth ?? RECEIPT_IMAGE_MAX_DIMENSION;
  const compress = options?.compress ?? 0.78;
  const fileName = options?.fileName ?? "upload.jpg";

  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress, format: ImageManipulator.SaveFormat.JPEG },
  );

  const sig = await apiClient("/house-wall/upload-signature", "POST");
  const cloudName = sig?.cloud_name;
  const apiKey = sig?.api_key;
  const timestamp = sig?.timestamp;
  const signature = sig?.signature;
  const folder = sig?.folder;

  if (!cloudName || !apiKey || !timestamp || !signature) {
    throw new Error("Upload signature missing (backend Cloudinary config?)");
  }

  const form = new FormData();
  form.append("file", {
    uri: manipulated.uri,
    name: fileName,
    type: "image/jpeg",
  } as any);
  form.append("api_key", String(apiKey));
  form.append("timestamp", String(timestamp));
  form.append("signature", String(signature));
  if (folder) form.append("folder", String(folder));

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: form,
    },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
  return {
    url: String(data.secure_url ?? data.url),
    publicId: data.public_id ? String(data.public_id) : null,
  };
}
