/**
 * One-time migration: SQLite (local file) → Supabase Postgres + Cloudinary.
 *
 * Run AFTER you've:
 *   1. Provisioned Supabase + Cloudinary and filled in .env
 *      (DATABASE_URL, DIRECT_DATABASE_URL, CLOUDINARY_*).
 *   2. Run `bun run db:push` to create the Postgres tables.
 *
 * Usage:
 *   bun run scripts/migrate-to-supabase.ts [path/to/custom.db] [--skip-files]
 *
 * Defaults to reading prisma/db/custom.db. `--skip-files` copies DB rows only
 * (use it if you've already uploaded the files, or don't have them locally).
 *
 * Idempotent: every insert is an upsert keyed by the row's id, so re-running
 * won't duplicate rows. Files use `overwrite: false` so a re-run won't replace
 * an already-uploaded asset.
 *
 * NOTE: Run with Bun (`bun run ...`). It reads the old SQLite file via Bun's
 * built-in `bun:sqlite` — no native module to compile. The script is decoupled
 * from the Prisma provider so the provider switch doesn't break the read path.
 */
import { Database } from "bun:sqlite"
import { createReadStream, existsSync } from "fs"
import path from "path"
import { PrismaClient } from "@prisma/client"
import { v2 as cloudinary } from "cloudinary"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SQLITE_PATH = process.argv.find((a) => !a.startsWith("-") && a !== process.argv[0] && a !== process.argv[1]) || "prisma/db/custom.db"
const SKIP_FILES = process.argv.includes("--skip-files")
const UPLOADS_ROOT = path.join(process.cwd(), "uploads")

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`✗ Missing env var: ${name}. Fill .env before running.`)
    process.exit(1)
  }
  return v
}

const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME")
cloudinary.config({
  cloud_name: cloudName,
  api_key: requireEnv("CLOUDINARY_API_KEY"),
  api_secret: requireEnv("CLOUDINARY_API_SECRET"),
  secure: true,
})

if (!existsSync(SQLITE_PATH)) {
  console.error(`✗ SQLite file not found: ${SQLITE_PATH}`)
  process.exit(1)
}

const sqlite = new Database(SQLITE_PATH, { readonly: true })
const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>

function all(table: string): Row[] {
  try {
    return sqlite.prepare(`SELECT * FROM "${table}"`).all() as Row[]
  } catch {
    return [] // table doesn't exist in this old snapshot
  }
}

/** Upsert a single row by id, preserving the original id. */
async function upsert<T extends { id: string }>(
  model: { upsert: (args: { where: { id: string }; create: T; update: T }) => Promise<unknown> },
  row: T,
): Promise<void> {
  await model.upsert({
    where: { id: row.id },
    create: row,
    update: row,
  })
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
  return Number.isFinite(n) ? n : fallback
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
async function main() {
  console.log(`\n=== PSMS: SQLite → Supabase + Cloudinary ===`)
  console.log(`  source : ${SQLITE_PATH}`)
  console.log(`  files  : ${SKIP_FILES ? "SKIP" : "upload to Cloudinary"}\n`)

  // Tables in dependency order (parents first). The Prisma models mirror the
  // schema exactly; null FKs are allowed where the schema permits.
  const tables = [
    "User",
    "StudentProfile",
    "SupervisorProfile",
    "Project",
    "Topic",
    "Document",
    "Milestone",
    "Feedback",
    "Message",
    "Notification",
    "Allocation",
    "SystemConfig",
  ] as const

  for (const table of tables) {
    const rows = all(table)
    if (rows.length === 0) {
      console.log(`  ${table.padEnd(20)} 0 rows (skipped)`)
      continue
    }
    // @ts-expect-error — dynamic model access by name
    const model = prisma[table.charAt(0).toLowerCase() + table.slice(1)]
    if (!model) {
      console.warn(`  ! Prisma has no model for ${table}; skipping`)
      continue
    }
    for (const row of rows) {
      await upsert(model, row as never)
    }
    console.log(`  ${table.padEnd(20)} ${rows.length} rows upserted`)
  }

  // Re-upload document files into Cloudinary and rewrite Document.filePath to
  // the returned public_id. Done AFTER the row upserts so we can update.
  if (!SKIP_FILES) {
    const docs = all("Document")
    let migrated = 0
    let missing = 0
    for (const doc of docs) {
      const id = String(doc.id ?? "")
      const oldPath = String(doc.filePath ?? "")
      const projectId = String(doc.projectId ?? "")
      if (!id || !oldPath || !projectId) continue

      const absFile = path.join(UPLOADS_ROOT, oldPath)
      if (!existsSync(absFile)) {
        console.warn(`  ! file missing on disk: ${oldPath}`)
        missing++
        continue
      }

      const publicId = `psms/${projectId}/${id}-${path.basename(oldPath)}`
      try {
        const result = await new Promise<{ public_id: string; bytes: number }>(
          (resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { public_id: publicId, resource_type: "raw", overwrite: false },
              (err, res) => {
                if (err || !res) return reject(err ?? new Error("no result"))
                resolve({ public_id: res.public_id, bytes: res.bytes })
              },
            )
            createReadStream(absFile).pipe(stream)
          },
        )
        await prisma.document.update({
          where: { id },
          data: { filePath: result.public_id },
        })
        migrated++
      } catch (err) {
        // overwrite:false returns an error if the asset exists; that's fine —
        // treat it as already-migrated. Anything else is a real failure.
        const msg = (err as { http_code?: number; message?: string })?.message ?? ""
        if (msg.includes("exists") || msg.includes("overwrite")) {
          await prisma.document.update({
            where: { id },
            data: { filePath: publicId },
          })
          migrated++
        } else {
          console.error(`  ✗ failed to upload ${oldPath}:`, err)
        }
      }
    }
    console.log(`\n  documents: ${migrated} uploaded, ${missing} files missing on disk`)
  }

  console.log(`\n✓ Migration complete.\n`)
}

main()
  .catch((err) => {
    console.error("\n✗ Migration failed:", err)
    process.exitCode = 1
  })
  .finally(async () => {
    sqlite.close()
    await prisma.$disconnect()
  })
