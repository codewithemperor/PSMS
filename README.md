# PSMS — Project Supervision Management System

A computer-based platform for managing **final-year project supervision** end-to-end:
students, supervisors, topics, documents, milestones, feedback, and real-time messaging.

Built for university departments (Computer Science and beyond) that need a single
place to track every student's project from topic submission to final approval.

> **Stack** — Next.js 16 (App Router) · TypeScript 5 · Prisma (PostgreSQL/Supabase) ·
> Tailwind CSS 4 · shadcn/ui · Supabase Realtime · Cloudinary · NextAuth.js · Recharts · Framer Motion.

---

## Table of Contents

1. [Features](#-features)
2. [Tech Stack](#-tech-stack)
3. [Prerequisites](#-prerequisites)
4. [Installation](#-installation)
5. [Running the App](#-running-the-app)
6. [Real-time Messaging (Supabase Realtime)](#-real-time-messaging-supabase-realtime)
7. [Building for Production](#-building-for-production)
8. [Demo Accounts](#-demo-accounts)
9. [Project Structure](#-project-structure)
10. [Database](#-database)
11. [Configuration](#-configuration)
12. [Troubleshooting](#-troubleshooting)

---

## ✨ Features

### For Students
- **Topic Submission Workflow** — Submit a project topic with title + description to your assigned supervisor.
  One active topic per student at a time. If your topic is rejected or sent back for revision,
  you can re-submit. While pending or approved, the submission form is locked.
- **State-Aware Dashboard** — Your dashboard always reflects the *current* state of your project
  journey: "No topic yet", "Topic Under Review", "Approved — Project Setup Pending",
  "Revision Required", or "Project Active". You'll never see a confusing "No project yet"
  message once you've submitted a topic.
- **My Project Page** — View your approved project details, milestones, and the supervisor
  assigned to you. State-aware panel shows your supervisor's name, email, department and
  specialization with a one-click "Contact Supervisor" button.
- **Upload Documents** — Upload proposals, drafts, literature reviews, methodology,
  data analysis, and final reports. The upload UI is **gated** — it only appears once
  your topic is approved and your project has started. Before that, you see a clear
  "Topic not approved yet" message with a button to contact your supervisor.
- **Document Review Thread** — Each uploaded document has its own bidirectional review page
  (chat-like timeline) where you and your supervisor can exchange feedback. New document
  versions are tracked in the timeline. Different from the main chat.
- **My Progress** — State-aware progress page that differentiates between
  "haven't submitted", "submitted but pending", "rejected", and "active project".
- **Real-time Chat** — Supabase-Realtime-powered 1:1 messaging with your supervisor, with typing
  indicators and read receipts.
- **Feedback Timeline** — See all feedback your supervisor has given across all your
  documents, with status (Pending / Addressed / Dismissed).

### For Supervisors
- **Personalized Dashboard** — Overview stats (My Students, Active Projects, Pending Reviews,
  Documents to Review), average student progress, milestone breakdown, upcoming deadlines,
  recent feedback, and recent activity feed.
- **My Students** — Paginated list of all students currently allocated to you, with their
  project status, progress, milestone completion, and last activity. Click any student to
  see their full project detail (overview, milestones, documents, feedback).
- **Topic Reviews** — Approve, reject, or send back for revision any pending topic submitted
  to you. Approving a topic automatically creates a Project with 5 fixed milestones
  (Topic Approval, Proposal Submission, Literature Review, Data Collection & Analysis,
  Final Report & Submission).
- **Fixed Milestone System** — Each project has 5 standard milestones. As a supervisor you
  can only **edit the due date and weight** of each milestone (not the name or order), and
  you can mark milestones In Progress / Completed. Completed milestones are **locked** —
  no further edits allowed. No "Add Milestone" button — the phases are fixed.
- **Documents to Review** — All documents uploaded by your students, displayed in a
  3-cards-per-row grid. Filter by student, document type, or "unreviewed only".
  A "Required Documents" checklist shows which document types each student has submitted
  vs. still owes.
- **Document Review Thread** — Per-document chat-like timeline for back-and-forth feedback
  with the student. Both supervisor and student can post messages. Timestamps on every
  message. New document versions are visible in the sidebar.
- **Quick Feedback** — Submit quick feedback on any document directly from the documents
  page without leaving the list.
- **Real-time Chat** — 1:1 messaging with any of your allocated students.

### For Administrators
- **Dashboard** — System-wide stats (users, projects, topics, documents, milestones,
  feedback, allocations) with charts (project status distribution, milestone breakdown,
  per-student progress, recent activity feed).
- **User Management** — Create, edit, activate/deactivate admins, supervisors, and students.
  Search and filter by role/status.
- **Topic Approval Oversight** — View all topics across the system (filter by status /
  supervisor / student). The actual approve/reject decision belongs to the assigned supervisor.
- **Smart Allocation** — Allocate students to supervisors in bulk, with capacity enforcement
  against a configurable global cap (`maxStudentsPerSupervisor`). Reassignment is fully
  supported: revoking the old allocation, creating a new one, updating the student's
  `StudentProfile.supervisorId`, **and** updating `Project.supervisorId` atomically
  (so the supervisor portal, dashboard, and feedback authorization all see the new
  supervisor). Capacity is enforced per-batch (projected load).
- **All Projects** — Browse every project in the system.
- **Department Overview** — Aggregated reports by department.
- **System Reports** — Cross-cutting analytics: students per supervisor, project status
  distribution, milestone completion rates, overdue milestones, etc.
- **App Settings** — Customize the app identity:
  - **App Name** (e.g. "PSMS — Project Supervision Management System") — used in the
    browser tab title, login page heading, and footer.
  - **App Short Name** (e.g. "PSMS-A") — used in the sidebar header, login page brand
    mark, and footer copyright.
  - **Logo URL** — if set, replaces the default GraduationCap icon in the sidebar and
    login page.
  - **Max Students Per Supervisor** — global capacity cap applied to all new allocations.
  - **Admin Password** — change the admin account password.

  All identity changes **auto-propagate** throughout the app immediately (sidebar, header,
  footer, login page, browser tab title) — no page reload required. The frontend reads
  from a shared Zustand store backed by a public `/api/system-config/public` endpoint;
  the admin save triggers an `invalidateAppConfig()` that re-fetches the new identity.

### Cross-cutting
- **Authentication** — NextAuth.js credentials provider. Role-based access control
  (ADMIN / SUPERVISOR / STUDENT) enforced both client-side (route guards) and server-side
  (API session checks).
- **Notifications** — In-app notification bell with unread badge. Notifications are
  generated for: topic submitted, topic approved/rejected, document uploaded, feedback
  given, milestone completed/due, allocation assigned/reassigned/revoked.
- **Responsive Design** — Mobile-first layout with sidebar collapsing to a drawer on
  small screens. All pages work on phone, tablet, and desktop.
- **Sticky Footer** — Footer sticks to the bottom of the viewport on short pages and is
  pushed down naturally when content overflows.
- **Dark-mode-ready** — Theme variables wired through Tailwind; light mode is default.
- **Real-time Chat** — Supabase Realtime Broadcast for 1:1 messaging with typing
  indicators, read receipts, and multi-tab support.

---

## 🧱 Tech Stack

| Layer | Technology |
|------|------------|
| Framework | **Next.js 16** (App Router, Turbopack) |
| Language | **TypeScript 5** |
| Styling | **Tailwind CSS 4** with **shadcn/ui** (New York) |
| Database | **PostgreSQL** on **Supabase**, via **Prisma ORM** |
| File storage | **Cloudinary** (direct browser upload of documents) |
| Auth | **NextAuth.js v4** (credentials provider) |
| State | **Zustand** (client) + **TanStack Query** (server) |
| Real-time | **Supabase Realtime** (Broadcast) |
| Charts | **Recharts** |
| Animation | **Framer Motion** |
| Icons | **Lucide React** |
| Forms | **React Hook Form** + **Zod** |
| Runtime | **Bun** (for dev, scripts, and the chat service) |

---

## ✅ Prerequisites

Install these on your machine before starting.

### 1. Node.js (≥ 20, LTS recommended)

The app is tested on Node.js 20 LTS and 24 LTS. Any version ≥ 20 will work.

- **macOS / Linux** — use [fnm](https://github.com/Schniz/fnm) or
  [nvm](https://github.com/nvm-sh/nvm):
  ```bash
  # Using fnm (recommended — faster)
  curl -fsSL https://fnm.vercel.app/install | bash
  fnm install 20
  fnm use 20

  # OR using nvm
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
  nvm install 20
  nvm use 20
  ```
- **Windows** — download the LTS installer from <https://nodejs.org> and run it.
- **Verify**:
  ```bash
  node --version    # should print v20.x or newer
  npm --version
  ```

### 2. Bun (≥ 1.3)

Bun is used as the dev runtime (faster than `next dev` alone) and as the package
manager.

- **macOS / Linux**:
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **Windows**:
  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```
- **Verify**:
  ```bash
  bun --version     # should print 1.3.x or newer
  ```

### 3. Git (to clone the repo)

```bash
git --version      # any recent version works
```

---

## 📦 Installation

```bash
# 1. Clone the repository
git clone <your-repo-url> psms
cd psms

# 2. Install dependencies (uses bun — fast)
bun install

# 3. Provision external services and copy env vars
#    See "Configuration → Environment variables" below for what you need:
#      - Supabase project (Postgres + Realtime)
#      - Cloudinary account (document storage)
cp .env.example .env       # then fill in the real values

# 4. Generate the Prisma client + create the schema in Postgres
bun run db:generate     # generates @prisma/client from schema.prisma
bun run db:push         # creates the tables in your Supabase Postgres DB

# 5. Seed the database with demo data
#    (8 users: 1 admin, 2 supervisors, 5 students — all password: password123)
bun run db:seed
```

> **Migrating from the old local SQLite setup?** Run the one-time migration
> script (`scripts/migrate-to-supabase.ts`) to copy existing rows into
> Supabase and re-upload local files into Cloudinary — see
> "Database → One-off data sync" below.

After step 5 you should see a summary like:
```
Demo logins (password: password123):
  admin@psms.edu
  supervisor1@psms.edu
  supervisor2@psms.edu
  student1@psms.edu
  student2@psms.edu
  student3@psms.edu
  student4@psms.edu
  student5@psms.edu
```

---

## ▶️ Running the App

The app is a single Next.js process. Real-time messaging runs **in-process**
via Supabase Realtime (no separate chat service to start), and documents are
stored in Cloudinary (no local `uploads/` directory needed).

```bash
bun run dev
# → http://localhost:3000
```

### Open the app

Visit <http://localhost:3000> in your browser. You'll see the login page with
one-click demo-account quick-fill buttons.

---

## 💬 Real-time Messaging (Supabase Realtime)

Real-time chat push is handled by **Supabase Realtime Broadcast** — there is no
separate Socket.IO process anymore.

- Persistence stays in the HTTP API (`POST/GET /api/messages`,
  `/api/conversations`, `/api/contacts`). Messages are **always** sent over HTTP,
  then the server publishes a `receive_message` event to the recipient's channel
  so it appears instantly.
- The browser (`src/lib/socket.ts`) is a thin facade over the Supabase JS client
  that exposes a Socket.IO-compatible surface (`.on/.off/.emit`, `.connected`),
  so the React chat components are unchanged.
- One Broadcast channel per user: `user-<userId>`.
- **Fallback:** if Supabase Realtime is unreachable, the Messages page still
  works — it polls `/api/conversations` every 15s.

> **Security note:** Broadcast channels are identified by name and subscribed
> with the anon key, so they are **not** cryptographically private. Authorization
> is enforced in the HTTP API (persistence), not the transport — a determined
> user with the anon key + a target userId could subscribe to that user's
> channel. This matches the app's existing posture. To harden, enable Supabase
> Realtime authorization (RLS-scoped channels / signed tokens) as a follow-up.

---

## 🏗️ Building for Production

### Deploying to Vercel (recommended)

This project targets **Vercel**. Push the repo to GitHub/GitLab and import it
into Vercel — no build configuration needed. Set the environment variables from
`.env.example` in the Vercel project settings (Production / Preview /
Development). The `postinstall` script runs `prisma generate` automatically, so
the Prisma client is built during install.

Before the first deploy, create the database schema once:

```bash
# Run locally with your Supabase DIRECT_DATABASE_URL set, OR via:
vercel env pull .env            # pull Vercel env vars into .env
bun run db:push                 # create the tables in Supabase Postgres
bun run db:seed                 # (optional) demo data
```

Because files go straight to Cloudinary and the DB is Postgres, there are **no
ephemeral-filesystem limitations** — uploads, downloads, and chat all work
normally on serverless.

### Self-hosting (Docker / Node)

```bash
bun run build          # next build (standard output)
bun run start          # next start -p 3000 → http://localhost:3000
```

---

## 🔑 Demo Accounts

All demo accounts use the password **`password123`**.

| Role | Email | Name | Notes |
|------|-------|------|-------|
| Admin | `admin@psms.edu` | Dr. Adewale Okonkwo | Full system access |
| Supervisor | `supervisor1@psms.edu` | Prof. Chinedu Eze | Has students 1, 2, 3 |
| Supervisor | `supervisor2@psms.edu` | Dr. Amina Bello | Has students 4, 5 |
| Student | `student1@psms.edu` | James Okafor | Approved project, IN_PROGRESS |
| Student | `student2@psms.edu` | Fatima Ibrahim | Approved project, IN_PROGRESS |
| Student | `student3@psms.edu` | Emeka Nwankwo | Approved project, IN_PROGRESS |
| Student | `student4@psms.edu` | Aisha Mohammed | Topic submitted (state varies) |
| Student | `student5@psms.edu` | Chidi Anyanwu | Topic revision required |

On the login page, click any of the demo-account quick-fill buttons to
auto-populate the email + password fields.

---

## 📁 Project Structure

```
psms/
├─ prisma/
│  ├─ schema.prisma              # 11 models + 9 enums (PostgreSQL)
│  ├─ seed.ts                    # idempotent demo-data seed
│  └─ sync-project-supervisor.ts # one-off data sync script
├─ public/
│  └─ logo.svg                   # graduation-cap favicon (emerald + gold)
├─ src/
│  ├─ app/                       # App Router pages + API routes
│  │  ├─ layout.tsx              # root layout (providers, fonts, metadata)
│  │  ├─ page.tsx                # login page
│  │  ├─ admin/                  # /admin/* routes
│  │  ├─ supervisor/             # /supervisor/* routes
│  │  ├─ student/                # /student/* routes
│  │  └─ api/                    # API route handlers
│  │     ├─ auth/                # NextAuth + register + seed
│  │     ├─ dashboard/           # /admin, /supervisor, /student dashboards
│  │     ├─ topics/              # topic submit + approve
│  │     ├─ projects/            # project CRUD + milestones
│  │     ├─ documents/           # upload-url, upload, list, download, feedback
│  │     ├─ document-review/     # bidirectional per-document review thread
│  │     ├─ milestones/          # milestone update (date/weight/status)
│  │     ├─ feedback/            # feedback CRUD + status
│  │     ├─ allocations/         # allocate + reassign + revoke
│  │     ├─ supervisors/         # supervisor list + their students
│  │     ├─ supervisor/          # supervisor-scoped helpers
│  │     ├─ messages/            # chat persistence + realtime publish
│  │     ├─ contacts/            # chat contact list
│  │     ├─ notifications/       # notification list + mark-read
│  │     ├─ users/               # user CRUD (admin)
│  │     ├─ reports/             # department + supervisor reports
│  │     ├─ stats/               # public system stats
│  │     └─ system-config/       # admin settings + public identity
│  ├─ components/
│  │  ├─ ui/                     # shadcn/ui components (New York style)
│  │  ├─ shared/                 # SectionCard, StatsCard, ProgressRing, etc.
│  │  ├─ layout/                 # sidebar, header, footer, mobile-nav
│  │  ├─ providers/              # auth, query, toast, realtime providers
│  │  ├─ dashboard/              # admin + supervisor dashboard components
│  │  ├─ admin/                  # admin-only components
│  │  ├─ supervisor/             # supervisor-only components
│  │  ├─ student/                # student-only components
│  │  └─ messaging/              # chat window, message bubble, chat list
│  ├─ stores/                    # Zustand stores (auth, app-config, notifications)
│  ├─ hooks/                     # use-toast, use-socket, use-mobile
│  ├─ lib/                       # db, auth, cloudinary, realtime, socket, utils
│  ├─ types/                     # shared TypeScript types
│  └─ middleware.ts              # route protection (proxy.ts in Next.js 16+)
├─ scripts/
│  └─ migrate-to-supabase.ts     # one-time SQLite→Postgres+Cloudinary migration
├─ start-dev.sh                  # local dev launcher (Next.js only)
├─ Caddyfile                     # gateway config (sandbox only — ignore on Vercel)
├─ package.json
├─ tsconfig.json
├─ tailwind.config.ts
├─ eslint.config.mjs
└─ README.md                     # ← you are here
```

---

## 🗄️ Database

- **Engine**: PostgreSQL, hosted on **Supabase** (managed Postgres + Realtime).
- **Connection**: two strings — `DATABASE_URL` (pooled, port 6543, used at
  runtime) and `DIRECT_DATABASE_URL` (direct, port 5432, used by migrations).
  Both come from your Supabase project's Database settings.
- **ORM**: Prisma. Schema lives at `prisma/schema.prisma` (11 models, 9 enums).
- **Models**: `User`, `StudentProfile`, `SupervisorProfile`, `Project`, `Topic`,
  `Document`, `Milestone`, `Feedback`, `Message`, `Notification`, `Allocation`,
  `SystemConfig`.
- **Document files**: stored in **Cloudinary** (not the DB). `Document.filePath`
  holds the Cloudinary `public_id`.

### Common commands

```bash
bun run db:generate    # regenerate @prisma/client after schema changes
bun run db:push        # push schema changes to Supabase Postgres
bun run db:migrate     # create + apply a Prisma migration (creates SQL files in prisma/migrations)
bun run db:reset       # DROP everything + re-create + re-seed (DESTRUCTIVE)
bun run db:seed        # seed demo data (idempotent — only runs if User table is empty)
```

### One-off data sync

**Migrating from the old local SQLite setup** — run the migration script to copy
existing rows into Supabase and re-upload local files into Cloudinary:

```bash
bun run scripts/migrate-to-supabase.ts
```

It reads `prisma/db/custom.db`, inserts every row into Postgres via the new
Prisma client (idempotent — upserts by id), and for each `Document` uploads the
file at its old `uploads/...` path to Cloudinary, storing the returned
`public_id` into `filePath`.

**Fixing stale `Project.supervisorId` rows** (e.g. a student was reassigned but
the project still points at the old supervisor):

```bash
bun run prisma/sync-project-supervisor.ts
```

This aligns every `Project.supervisorId` with the student's current active
allocation. Safe to re-run — it's idempotent.

---

## ⚙️ Configuration

### Environment variables

All variables are documented in `.env.example` (copy it to `.env` for local
dev, or set them in your Vercel project settings). Four groups:

**Database (Supabase Postgres)**
```
DATABASE_URL            # pooled (PgBouncer, port 6543) — used at runtime
DIRECT_DATABASE_URL     # direct (port 5432) — used by Prisma migrations
```

**Document storage (Cloudinary)**
```
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

**Realtime chat (Supabase Realtime)**
```
SUPABASE_URL                    # server: used to PUBLISH events
SUPABASE_SERVICE_ROLE_KEY       # server: pairs with SUPABASE_URL
NEXT_PUBLIC_SUPABASE_URL        # browser: used to SUBSCRIBE
NEXT_PUBLIC_SUPABASE_ANON_KEY   # browser: pairs with the public URL
```

**Auth**
```
NEXTAUTH_SECRET                 # any long random string (openssl rand -base64 32)
NEXTAUTH_URL                    # http://localhost:3000 locally; your Vercel URL in prod
```

### Admin-configurable settings

The admin Settings page (`/admin/settings`) lets you configure at runtime:

- **App Name** — full name shown in the browser tab title + login page heading + footer.
- **App Short Name** — short label in the sidebar header + login brand mark + footer copyright.
- **Logo URL** — if set, replaces the default GraduationCap icon. Provide a full URL or a
  path under `/public/`.
- **Max Students Per Supervisor** — global capacity cap. Lowering this does NOT revoke
  existing allocations; it only blocks new ones that would exceed the cap.
- **Admin Password** — change the admin account password.

All identity changes propagate immediately throughout the app (no reload needed)
via a shared Zustand store + a public `/api/system-config/public` endpoint.

### Default app identity

Until you change it in Settings, the defaults are:
- App Name: `PSMS — Project Supervision Management System`
- App Short Name: `PSMS`
- Logo: GraduationCap icon (no custom URL)
- Max Students Per Supervisor: `5`

---

## 🛠️ Troubleshooting

### `PrismaClientValidationError: Unknown argument maxStudentsPerSupervisor`
You need to push the latest schema to your local DB:
```bash
bun run db:generate
bun run db:push
```
The schema already has the field; this just syncs your Supabase Postgres DB.

### Dashboard shows "4 active projects but only 2 students"
This was a bug where `Project.supervisorId` could drift stale when a student
was reassigned via the revoke endpoint. It is now fixed:
1. The supervisor dashboard endpoint filters all counts by **active allocations**
   (the single source of truth), not by `Project.supervisorId`.
2. The batch allocation endpoint updates `Project.supervisorId` atomically when
   reassigning a student.
3. The `/api/stats` route was also fixed to use active allocations.
4. A one-off data sync script (`prisma/sync-project-supervisor.ts`) aligns any
   existing stale rows.

If you still see a mismatch, run:
```bash
bun run prisma/sync-project-supervisor.ts
```

### Real-time chat isn't updating live
Real-time messaging uses Supabase Realtime Broadcast — there is no separate chat
process to start. If messages stop arriving live:
- Verify `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
  (the browser needs them to subscribe).
- Verify `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are set (the server needs
  them to publish).
- In your Supabase dashboard, confirm Realtime is enabled for the project.
- Messages still send and receive over HTTP + 15s polling regardless, so chat
  is never fully broken.

### Next.js dev server won't start (port 3000 in use)
```bash
lsof -i :3000           # find the PID
kill -9 <PID>
bun run dev
```

### `middleware` deprecation warning
Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`. The current
`src/middleware.ts` still works (with a benign warning). To silence it, rename
the file:
```bash
mv src/middleware.ts src/proxy.ts
```

### Login fails with "Invalid credentials"
- Make sure you ran `bun run db:seed` to create the demo users.
- All demo passwords are `password123`.
- If you changed the admin password via Settings, use the new password for `admin@psms.edu`.

### Messages don't persist / "Receiver not found"
Chat persistence goes through `POST /api/messages`. If sending fails, check
that your Supabase database is reachable (`DATABASE_URL` pooled connection) and
that the `User`/`Message`/`Allocation` tables exist (`bun run db:push`).

### Prisma client out of sync
If you see TypeScript errors about missing Prisma model fields, regenerate:
```bash
bun run db:generate
# then restart the dev server
```

---

## 📜 License

Internal use. © PSMS Team.

