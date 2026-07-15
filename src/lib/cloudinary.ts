import { v2 as cloudinary } from "cloudinary"
import type { ReadStream } from "fs"

/**
 * Cloudinary helper layer.
 *
 * Documents are stored as `resource_type: "raw"` assets (PDF/DOCX/DOC). The
 * `Document.filePath` column stores the Cloudinary **public_id** of the asset
 * (NOT a filesystem path) — this is what upload/download/delete all key off.
 *
 * Uploads happen DIRECTLY from the browser to Cloudinary using a signed
 * token issued by `/api/documents/upload-url`. This keeps large file bodies
 * out of the serverless function (Vercel caps request bodies at ~4.5MB) and
 * lets the 10MB limit work on Vercel.
 */

// ---------------------------------------------------------------------------
// Lazy config — validate env vars up-front so a misconfigured deployment
// fails loudly on first use rather than at build time.
// ---------------------------------------------------------------------------
let configured = false
function ensureConfigured() {
  if (configured) return
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "[cloudinary] Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET env vars.",
    )
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
  configured = true
}

/** Top-level folder for every PSMS document asset. */
const ROOT_FOLDER = "psms"

export interface SignedUploadParams {
  /** Cloudinary cloud name — the browser posts to api.cloudinary.com with this. */
  cloudName: string
  /** Fully-qualified folder the browser should upload into, e.g. "psms/<projectId>". */
  folder: string
  /** The timestamp to send as `timestamp` in the upload form. */
  timestamp: number
  /** The signature string to send as `signature`. */
  signature: string
  /** The API key to send as `api_key`. */
  apiKey: string
  /** `resource_type` to pass in the upload URL: "raw" for documents. */
  resourceType: "raw"
  /** The upload URL the browser POSTs to. */
  uploadUrl: string
}

/**
 * Build signed parameters the browser needs to upload a file directly to
 * Cloudinary. The signature authorizes a single upload into `psms/<subfolder>`.
 * Expires in ~1 hour (Cloudinary's default signature window).
 *
 * Files are uploaded as `type: "authenticated"` so they are NOT publicly
 * accessible — only a signed URL (generated server-side at download time)
 * can fetch them. This keeps student documents private.
 */
export function signUploadParams(subfolder: string): SignedUploadParams {
  ensureConfigured()
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!

  const folder = subfolder ? `${ROOT_FOLDER}/${subfolder}` : ROOT_FOLDER
  const timestamp = Math.round(Date.now() / 1000)
  // `type` MUST be part of the signature, and the browser must send the same
  // value in its form data, or the upload is rejected.
  const type = "authenticated"

  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp, type },
    apiSecret,
  )

  return {
    cloudName,
    folder,
    timestamp,
    signature,
    apiKey,
    resourceType: "raw",
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
  }
}

/**
 * Produce a short-lived (1 hour) signed delivery URL for a raw asset.
 * The download route 302-redirects the browser to this URL.
 *
 * Files are uploaded with `type: "authenticated"`, so they can ONLY be
 * fetched via a signed URL — they are not publicly accessible. We build the
 * authenticated delivery URL via `utils.url({ type: "authenticated" })` rather
 * than the `private_download_url` API, because the latter (the v1 download
 * endpoint) does not reliably resolve raw files whose public_id includes an
 * extension, while the delivery URL does.
 *
 * `publicId` is what's stored in `Document.filePath`. Pass the original
 * `fileName` so Cloudinary serves it with a friendly `Content-Disposition`.
 */
export function signedDownloadUrl(publicId: string, fileName?: string): string {
  ensureConfigured()
  return cloudinary.utils.url(publicId, {
    resource_type: "raw",
    type: "authenticated",
    sign_url: true,
    // Force a download (Content-Disposition: attachment) with the real name.
    attachment: fileName || publicId.split("/").pop() || "document",
    // Absolute Unix timestamp (seconds) — 1 hour from now.
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    secure: true,
  })
}

/**
 * Best-effort deletion of an asset. Returns true if removed (or already gone).
 * Callers should treat failure as non-fatal — the DB row is the source of
 * truth for the application; an orphaned Cloudinary asset is recoverable.
 */
export async function destroyAsset(publicId: string): Promise<boolean> {
  ensureConfigured()
  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: "raw",
    })
    return res.result === "ok" || res.result === "not found"
  } catch (err) {
    console.error("[cloudinary] destroyAsset failed:", publicId, err)
    return false
  }
}

/**
 * Server-side upload from a buffer/stream (used only by the one-time
 * migration script to push existing local files into Cloudinary).
 */
export async function uploadStream(
  stream: ReadStream,
  publicId: string,
): Promise<{ publicId: string; size: number }> {
  ensureConfigured()
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "raw", overwrite: false },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("no result"))
        resolve({ publicId: result.public_id, size: result.bytes })
      },
    )
    stream.pipe(uploadStream)
  })
}
