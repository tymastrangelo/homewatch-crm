# HomeWatch CRM – Residential Service Operations

HomeWatch CRM is a full-stack operations hub designed for residential maintenance and home-watch companies. It centralizes client information, properties, service requests, scheduling, and expenses so the team can manage every visit from a single place.

This version of the app powers an internal workflow used to prep, schedule, and document recurring property check-ins, while keeping accounting and job status synchronized across teams.

---

## Highlights

- **Real-time Dashboard** – Track upcoming visits, outstanding quotes, and financial health with live metrics and charts.
- **Client + Property Management** – Store client profiles, manage multiple addresses per client, and capture service history per property.
- **Job Lifecycle Tracking** – Create work orders, assign technicians, progress jobs through custom statuses, and push scheduled visits to shared sheets.
- **Quotes & Invoicing** – Generate and review service quotes, record approvals, and stay on top of receivables and payouts.
- **Expense Logging** – Capture line-item expenses directly in the CRM to maintain accurate profit tracking.
- **Authentication & Access Control** – Supabase Auth keeps data protected while enabling secure multi-user access.
- **Google Sheets Integration** – Critical events (like confirmed jobs) can be mirrored to a Google Sheet via server-side API routes for reporting and backups.

---

## Stack

| Layer        | Technology |
| ------------ | ---------- |
| Framework    | Next.js 14 (App Router) |
| Language     | TypeScript |
| Database     | Supabase (PostgreSQL, Auth, Storage) |
| Styling      | Tailwind CSS |
| Charts       | Recharts |
| Deployment   | Vercel |

### Architectural Notes

- **Hybrid Rendering** – Server components fetch initial data (e.g., clients) while client components manage interactive flows like modals and inline edits.
- **Supabase SDKs** – Uses the server client for secure data access in RSCs and the browser client for authenticated mutations.
- **API Routes** – Custom Next.js API endpoints handle integrations such as syncing job data to Google Sheets.
- **State Management** – React hooks (`useState`, `useMemo`, `useEffect`) provide localized state; the design emphasizes predictable, testable components.

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or pnpm/yarn)
- Supabase project + service role key

### Installation

1. **Clone and install**
   ```sh
   git clone https://github.com/tymastrangelo/homewatch-crm.git
   cd homewatch-crm
   npm install
   ```

2. **Environment variables**
   Create `.env.local` with the following keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=public-anon-key
   SUPABASE_SERVICE_ROLE_KEY=service-role-key
   GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEETS_JOB_SYNC_ID=your-sheet-id
   ```

   Adjust keys to match the integrations you enable. Service-role and Google credentials are required only if you plan to run the server-side job sync locally.

3. **Database schema**
   - The schema lives in `schema-file.txt`. Run the SQL statements in Supabase or rename the file to `schema.sql` for better tooling support.
   - Enable Row Level Security (RLS) on each table and create policies that scope records by `user_id`.
   - Seed data using the Supabase SQL editor or `psql` to import sample clients, properties, and jobs.

4. **Run locally**
   ```sh
   npm run dev
   ```
   Visit `http://localhost:3000`.

---

## Key Commands

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Create an optimized production build |
| `npm run start` | Run the production build |
| `npm run lint` | Lint the project with ESLint |

---

## Project Structure

```
src/
  app/
    clients/           // Client + property management UI
    jobs/              // Job pipeline and scheduling pages
    quotes/            // Quote review workflow
    expenses/          // Expense tracking
    dashboard/         // Main analytics overview
    calculator/        // Pricing calculator for service packages
    api/               // Custom API routes (Supabase + Google integrations)
  components/
    Modal.tsx          // Shared dialog component
    AppShell.tsx       // Layout + navigation
    ClientsManager.tsx // Client list + detail modal
  lib/
    supabaseClient.ts  // Browser Supabase client factory
    supabaseServerClient.ts // Server-side Supabase client helper
    types.ts           // Generated Supabase types
```

---

## Future Enhancements

- Supabase Realtime for live updates across dashboards
- Job routing + technician notifications via email/SMS
- Offline-first PWA mode for field technicians
- Automated invoice generation and payment links
- Component/E2E testing (Jest, Testing Library, Cypress)

---

## Contact

Tyler Mastrangelo – [linkedin.com/in/tymastrangelo](https://www.linkedin.com/in/tymastrangelo) – mastrangelo.tyler@gmail.com

Project Link: [https://github.com/tymastrangelo/homewatch-crm](https://github.com/tymastrangelo/homewatch-crm)