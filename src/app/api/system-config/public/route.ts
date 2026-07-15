import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/system-config/public
 *
 * Public endpoint (NO auth required) that returns only the app-identity
 * fields (appName, appShortName, logoUrl). This is consumed by the login
 * page, sidebar, header, footer, and the dynamic document title so that
 * when an admin changes the app name/logo/short name in Settings, the
 * change propagates everywhere immediately.
 *
 * Capacity (maxStudentsPerSupervisor) and other admin-only fields are
 * intentionally NOT exposed here.
 */
export async function GET() {
  let config = await db.systemConfig.findFirst({
    select: {
      appName: true,
      appShortName: true,
      logoUrl: true,
    },
  })
  if (!config) {
    // Create the singleton with schema defaults on first access.
    const created = await db.systemConfig.create({ data: {} })
    config = {
      appName: created.appName,
      appShortName: created.appShortName,
      logoUrl: created.logoUrl,
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      appName: config.appName,
      appShortName: config.appShortName,
      logoUrl: config.logoUrl,
    },
  })
}
