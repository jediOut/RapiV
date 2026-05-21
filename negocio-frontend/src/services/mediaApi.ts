import { apiRequest } from "./apiClient";

type MediaTargetType = "business-logo" | "product-image";

type UploadUrlResponse = {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  expiresInSeconds: number;
};

export async function createMediaUploadUrl(
  token: string,
  payload: {
    targetType: MediaTargetType;
    targetId: string;
    contentType: "image/jpeg" | "image/png" | "image/webp";
  }
): Promise<UploadUrlResponse> {
  return apiRequest<UploadUrlResponse>("/media/upload-url", {
    method: "POST",
    token,
    body: payload
  });
}

export async function uploadImageToS3(
  uploadUrl: string,
  uri: string,
  contentType: "image/jpeg" | "image/png" | "image/webp"
): Promise<void> {
  const imageResponse = await fetch(uri);
  const blob = await imageResponse.blob();
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": contentType
    },
    body: blob
  });

  if (!uploadResponse.ok) {
    throw new Error("No se pudo subir la imagen");
  }
}
