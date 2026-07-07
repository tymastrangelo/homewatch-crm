# 239 Home Services — Home Watch CRM

An internal tool for a residential **home-watch** company. Inspectors visit vacant /
seasonal homes, complete a standardized inspection checklist (with photos, notes, and
temperature readings), and email the homeowner a polished PDF report. The team gets a
dashboard of recent visits and which reports still need to be sent.

It is a **shared company workspace**: every signed-in staff member sees and manages the
same clients, properties, inspectors, and checklists.

---

## What it does

- **Dashboard** — totals, what's waiting to be emailed, open issues, and recent visits.
- **Checklists** — searchable list of every inspection, filterable by status / issues / sent.
- **New checklist** — pick (or add) a client, property, and inspector; mark each of the
  ~32 standard inspection points OK / Issue / N/A / Skip; attach photos and notes;
  record interior temperatures; add summary comments.
- **PDF report** — a themed, professional report (`src/lib/reportPdf.ts`): navy header band,
  summary tiles, status pills, photo appendix, page footers. Preview/download it from any
  checklist (`GET /api/checklists/[id]/pdf`) or email it to the homeowner via SMTP — both
  routes share the same renderer. Example output lives in `docs/mock-reports/`.
- **Mobile-native shell** — bottom tab bar with a raised "New checklist" action, bottom-sheet
  modals, and PWA manifest + icons so staff can add it to their home screen.
- **Clients & inspectors** — lightweight management of clients (with multiple property
  addresses) and the inspectors on staff.

## Stack

| Layer     | Technology |
| --------- | ---------- |
| Framework | Next.js 15 (App Router, Server Actions) |
| Language  | TypeScript |
| Database  | Supabase (PostgreSQL · Auth · Storage) |
| Styling   | Tailwind CSS v4 |
| PDF       | PDFKit (standard fonts embedded — no build-time font juggling) |
| Email     | Nodemailer (SMTP) |

---

## Architecture notes

- **Real columns, not a JSON blob.** Visit metadata (inspector, comments, temperatures,
  email-sent status) lives in real, query-able columns on `checklists`. Checklist items
  carry a stable `item_key` and `sort_order` so reports always render in the intended order.
- **One server action saves everything.** `src/app/actions/checklists.ts#saveChecklist`
  resolves the client / property / inspector and writes the checklist + items + photos in
  one place, server-side, under the signed-in user's RLS context. Photos upload directly
  from the browser to Supabase Storage; only their paths flow through the action.
- **Reads go through `src/lib/checklistData.ts`**, which returns clean view models (with
  signed photo URLs) for the dashboard, list, detail, and edit pages.
- **Auth** is enforced in `middleware.ts` using `supabase.auth.getUser()` (validates the
  token), with `@supabase/ssr` cookie handling.

---

## Getting started

### 1. Install

```sh
npm install
```

### 2. Environment — create `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# SMTP (required to email reports)
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-pass
EMAIL_FROM="239 Home Services <info@239homeservices.com>"
# SMTP_SECURE=true   # optional; defaults to true only when SMTP_PORT=465
```

### 3. Apply the database migration — **required**

The app expects the upgraded schema. Open the Supabase **SQL Editor** and run:

```
supabase/migrations/0001_core_schema_overhaul.sql
```

It is **idempotent and non-destructive**: it adds the new columns, backfills every
existing checklist from the old JSON `notes` blob, sets up the shared-workspace RLS
policies, and creates the `checklist-photos` storage bucket. Nothing is deleted.
(After you've confirmed the data looks right in the app, you may optionally run the
commented-out final statement to clear the now-redundant `notes` blob.)

> Until this migration is applied, pages that read the new columns will error — so run it first.

### 4. Run

```sh
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # lint
```

Create a staff login from the Supabase **Authentication** dashboard, then sign in at `/login`.

---

## Project structure

```
src/
  app/
    actions/checklists.ts      # saveChecklist / deleteChecklist server actions
    api/checklists/[id]/email  # PDF generation + email route
    checklist/                 # new checklist page
    checklists/                # list, [id] detail, [id]/edit
    clients/  inspectors/      # management pages
    dashboard/                 # overview
    login/  auth/callback/     # auth
  components/                  # ChecklistForm, cards, managers, shell, nav
  lib/
    checklistTemplate.ts       # the canonical 32-point inspection template
    checklistData.ts           # server-side read models
    constants.ts  types.ts     # company info, DB types
supabase/migrations/           # SQL migration + backfill
```
