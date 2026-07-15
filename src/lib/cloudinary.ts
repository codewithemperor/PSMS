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
}

/**
 * Build signed parameters the browser needs to upload a file directly to
 * Cloudinary. The signature authorizes a single upload into `psms/<subfolder>`.
 * Expires in ~1 hour (Cloudinary's default signature window).
 */
export function signUploadParams(subfolder: string): SignedUploadParams {
  ensureConfigured()
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!
  const apiKey = process.env.CLOUDINARY_API_KEY!
  const apiSecret = process.env.CLOUDINARY_API_SECRET!

  const folder = subfolder ? `${ROOT_FOLDER}/${subfolder}` : ROOT_FOLDER
  const timestamp = Math.round(Date.now() / 1000)

  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    apiSecret,
  )

  return {
    cloudName,
    folder,
    timestamp,
    signature,
    apiKey,
    resourceType: "raw",
  }
}

/**
 * Produce a short-lived (1 hour) signed URL for downloading a raw asset.
 * The download route 302-redirects the browser to this URL.
 *
 * `publicId` is what's stored in `Document.filePath`. Pass the original
 * `fileName` so Cloudinary serves it with a friendly `Content-Disposition`.
 */
export function signedDownloadUrl(publicId: string, fileName?: string): string {
  ensureConfigured()
  return cloudinary.utils.private_download_url(publicId, "raw", {
    // Cloudinary inspects the extension of `attachmentName` to pick a
    // Content-Type, so keep the real extension on it.
    attachmentName: fileName || publicId.split("/").pop() || "document",
    expiresAt: 3600, // 1 hour, in seconds
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
