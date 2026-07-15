#!/bin/bash
# Local dev launcher. Starts the Next.js dev server (port 3000).
#
# NOTE: Real-time chat no longer runs as a separate Socket.IO mini-service —
# it's handled in-process via Supabase Realtime (see src/lib/socket.ts). So
# this script just starts Next.js. Configure your Supabase + Cloudinary env
# vars in .env (copy from .env.example) before running.
cd "$(dirname "$0")"
exec bunx --bun next dev -p 3000
