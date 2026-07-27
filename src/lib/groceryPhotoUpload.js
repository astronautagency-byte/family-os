// ─────────────────────────────────────────────────────────────────────
// Grocery photo upload utility.
//
// Two-stage pipeline so the round-trip is fast on slow cellular:
//
// 1. compressImage(file): resize to max 1200px on the longest edge via
//    <canvas>, encode as JPEG @ 0.82 quality. Typical 3-4MB phone-camera
//    JPEG shrinks to ~150-300KB; bandwidth and storage costs stay sane.
//    EXIF orientation is honoured via createImageBitmap so portrait
//    shots don't come out sideways.
//
// 2. uploadGroceryPhoto({ householdId, file, supabase, itemId }): writes
//    to the `grocery-photos` bucket at `{household_id}/{itemId|v}.jpg`
//    and returns the public URL we store on grocery_items.photo_url.
//
// deleteGroceryPhoto(url, supabase) parses the path back out of the
// public URL and removes the underlying object so abandoned uploads
// don't leak storage cost forever.
//
// Bucket is declared PUBLIC (read) in supabase/migrations/202607260010_*
// because SECURITY DEFINER storage paths under household folders are
// effectively unguessable UUIDs; the meaningful privacy gate is the
// household_members INSERT/DELETE policy on storage.objects, written
// alongside the bucket.
// ─────────────────────────────────────────────────────────────────────

const MAX_LONG_EDGE = 1200;
const JPEG_QUALITY = 0.82;
// Browsers that can decode HEIC in createImageBitmap (Safari iOS,
// recent Safari macOS) handle the conversion fine; Chrome/Firefox on
// desktop cannot reliably decode HEIC and would fail silently. Reject
// HEIC at the picker layer with a friendly message so the user
// converts once instead of staring at a broken upload.
const HEIC_HEADER = "image/heic";

export function isUploadableImage(file) {
  if (!file || !file.type) return { ok: false, reason: "Please pick an image file." };
  if (file.type === HEIC_HEADER || file.type === "image/heif") {
    return { ok: false, reason: "HEIC photos need to be converted to JPEG first. On iPhone, change Settings → Camera → Formats to Most Compatible." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, reason: "That doesn't look like an image. Pick a JPEG, PNG, or WebP." };
  }
  return { ok: true };
}

// Resize + re-encode. createImageBitmap is widely supported (Chrome
// 76+, Firefox 63+, Safari 15+) so we don't bother with an <img>+URL
// fallback — if the browser can't decode the file the upload will fail
// cleanly via the try/catch instead. Refusing HEIC at the input layer
// (handled in isUploadableImage below) means we never hit Chrome's
// missing HEIC decoder in the first place.
export async function compressImage(file) {
  if (!file || typeof window === "undefined") return file;
  if (!file.type || !file.type.startsWith("image/")) return file;
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const { width, height } = bitmap;
    if (!width || !height) return file;
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(targetWidth, targetHeight)
      : Object.assign(document.createElement("canvas"), { width: targetWidth, height: targetHeight });
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    if (typeof bitmap.close === "function") bitmap.close();

    const blob = await canvasToBlob(canvas, file.type === "image/png" ? "image/png" : "image/jpeg", JPEG_QUALITY);
    if (!blob) return file;
    // If compression ended up larger than the original (rare; only with
    // tiny GIFs or already-tiny PNGs), prefer the source file so we
    // can't accidentally bloat a small file.
    if (blob.size >= file.size) return file;
    return blob;
  } catch (error) {
    console.warn("Image compression failed; uploading original.", error);
    return file;
  }
}

function canvasToBlob(canvas, mimeType, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type: mimeType, quality });
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), mimeType, quality));
}

// Build a stable bucket-relative path. Prefers the user-supplied
// itemId (so replacing a photo overwrites the same path and gives the
// realtime diff a clean old-vs-new). Falls back to a fresh timestamped
// id when adding a brand-new item whose row id is still optimistic
// (FamilyContext pre-allocates a makeId before the server confirms).
export function buildPhotoPath(householdId, itemIdHint) {
  const safeHouseholdId = String(householdId || "").replace(/[^a-z0-9-]/gi, "");
  if (!safeHouseholdId) throw new Error("Household id is required for photo upload.");
  const slug = itemIdHint ? `${itemIdHint}_${Date.now().toString(36)}` : `new_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  return `${safeHouseholdId}/${slug}.jpg`;
}

// Extract the path from a stored public URL so we can delete the
// underlying object without keeping a separate column.
export function pathFromPublicUrl(publicUrl) {
  if (!publicUrl || typeof publicUrl !== "string") return null;
  const marker = "/storage/v1/object/public/grocery-photos/";
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(publicUrl.slice(idx + marker.length));
}

export async function uploadGroceryPhoto({ householdId, file, supabase, itemIdHint, onProgress }) {
  if (!supabase) throw new Error("Supabase client unavailable — cannot upload a grocery photo.");
  if (!householdId) throw new Error("Household id is required for photo upload.");
  if (!file) throw new Error("A photo file is required to upload.");

  const compressed = await compressImage(file);
  const path = buildPhotoPath(householdId, itemIdHint);
  const contentType = compressed.type || "image/jpeg";

  const { error } = await supabase.storage
    .from("grocery-photos")
    .upload(path, compressed, { cacheControl: "31536000", contentType, upsert: false });
  if (error) throw error;

  const { data: publicData } = supabase.storage.from("grocery-photos").getPublicUrl(path);
  if (!publicData?.publicUrl) throw new Error("Could not resolve the grocery-photo public URL.");
  onProgress?.({ phase: "uploaded", path, url: publicData.publicUrl });
  return { path, url: publicData.publicUrl };
}

export async function deleteGroceryPhoto(publicUrl, supabase) {
  if (!supabase || !publicUrl) return { error: null };
  const path = pathFromPublicUrl(publicUrl);
  if (!path) return { error: null };
  const { error } = await supabase.storage.from("grocery-photos").remove([path]);
  return { error };
}
