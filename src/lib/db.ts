import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// In development, the global singleton may hold a stale PrismaClient if the
// Prisma schema was regenerated mid-process. Detect this by checking whether
// the `systemConfig` delegate exists; if not, discard the cached instance
// AND clear Node's require cache for the generated Prisma client so a fresh
// client (built from the newly-generated Prisma Client) is created.
if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma) {
  const cached = globalForPrisma.prisma as unknown as {
    systemConfig?: unknown
  }
  if (!cached.systemConfig) {
    console.log('[db] detected stale PrismaClient — refreshing')
    try {
      void globalForPrisma.prisma.$disconnect()
    } catch {
      // ignore
    }
    globalForPrisma.prisma = undefined
    // Force Next.js / Node to re-require the freshly generated Prisma client.
    for (const key of Object.keys(require.cache)) {
      if (key.includes('.prisma/client') || key.includes('@prisma/client')) {
        delete require.cache[key]
      }
    }
  }
}

const { PrismaClient: FreshPrismaClient } =
  process.env.NODE_ENV !== 'production'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@prisma/client')
    : { PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new (FreshPrismaClient as typeof PrismaClient)({
    // Query logging is noisy in production (and costs log volume on Vercel),
    // so only enable it during local development.
    log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['query'],
  })

console.log(
  '[db] new PrismaClient created — has systemConfig:',
  !!(db as unknown as { systemConfig?: unknown }).systemConfig,
)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
