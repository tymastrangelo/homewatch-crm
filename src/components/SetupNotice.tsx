import { AlertIcon } from '@/components/icons'
import type { ReadStatus } from '@/lib/checklistData'

export default function SetupNotice({ status }: { status: ReadStatus }) {
  if (status === 'ok') return null

  const content =
    status === 'setup-required'
      ? {
          title: 'Finish database setup',
          body: 'The app is connected, but the database schema needs to be updated. Run the migration in supabase/migrations/0001_core_schema_overhaul.sql (Supabase SQL Editor), then refresh.'
        }
      : status === 'permission-denied'
        ? {
            title: 'Access blocked by row-level security',
            body: 'Apply the migration (which sets the shared-workspace policies) so signed-in staff can read records, then refresh.'
          }
        : {
            title: 'Could not load data',
            body: 'Something went wrong talking to the database. Check your Supabase connection and try again.'
          }

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
      <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold">{content.title}</p>
        <p className="mt-1 text-sm leading-relaxed">{content.body}</p>
      </div>
    </div>
  )
}
