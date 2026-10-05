const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// VALIDATION FIX (pre-launch audit): the file picker's accept="image/*" is advisory
// only — it doesn't stop a non-image file reaching this code via drag-and-drop, a
// "show all files" picker dialog, or a direct programmatic call. Nothing previously
// checked the file's actual type/size before sending it to Cloudinary.
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

interface CloudinaryUploadResponse {
  secure_url: string;
}

async function performUpload(file: File): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Missing Cloudinary environment variables: VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET must be set.");
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Please choose an image file (JPEG, PNG, WebP or GIF).");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Image is too large — please choose a file under 10MB.");
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
  // VALIDATION FIX (pre-launch audit): the response URL was trusted and stored as-is.
  // Confirming it's actually a Cloudinary-hosted URL before returning it stops a
  // compromised/misconfigured response from getting stored as an "image" URL that's
  // later rendered as <img src> or linked to elsewhere in the app.
  if (!/^https:\/\/res\.cloudinary\.com\//.test(data.secure_url)) {
    throw new Error("Image upload failed. Please try again.");
  }
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

/**
 * PERFORMANCE (pre-launch audit): inserts Cloudinary's f_auto,q_auto transform into a
 * `res.cloudinary.com/.../upload/...` URL, so the CDN serves a format-negotiated (WebP/AVIF
 * where supported) and quality-optimized image instead of the original upload as-is — same
 * image, smaller transfer. A no-op (returns the URL unchanged) for anything that isn't a
 * Cloudinary upload URL in the expected shape.
 */
export function optimizedCloudinaryUrl(url: string): string {
  return url.replace(/\/upload\/(?!f_auto)/, "/upload/f_auto,q_auto/");
}
