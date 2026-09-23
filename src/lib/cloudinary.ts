const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

interface CloudinaryUploadResponse {
  secure_url: string;
}

async function performUpload(file: File): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Missing Cloudinary environment variables: VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET must be set.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Image upload failed. Please try again.");
  }

  const data = (await response.json()) as CloudinaryUploadResponse;
  return data.secure_url;
}

/**
 * Uploads an image file to Cloudinary using an unsigned upload preset and returns its hosted URL.
 *
 * Admin-only (gallery images). `sessionAccessToken` must be the current Supabase session's access
 * token — its presence is how this helper confirms it's only ever called from an authenticated
 * admin context. The token itself isn't sent to Cloudinary (an unsigned preset takes no auth), so
 * this only gates our own UI; it cannot make the preset itself un-callable by someone hitting
 * Cloudinary directly.
 */
export async function uploadImage(file: File, sessionAccessToken: string | null | undefined): Promise<string> {
  if (!sessionAccessToken) {
    throw new Error("You must be signed in to upload images.");
  }
  return performUpload(file);
}

/**
 * Uploads an image file to Cloudinary using the same unsigned preset, for the
 * public (unauthenticated) client booking flow — someone booking an appointment
 * attaches a reference photo of the style they want before they've signed in
 * anywhere (they never do). No session check here; that's intentional.
 */
export async function uploadToCloudinary(file: File): Promise<string> {
  return performUpload(file);
}
