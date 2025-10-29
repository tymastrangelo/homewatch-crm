import InspectorsManager from '@/components/InspectorsManager'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import type { Inspector } from '@/lib/supabaseClient'

export const revalidate = 0

export default async function InspectorsPage() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('inspectors')
    .select('id, user_id, name, email, phone, created_at, updated_at')
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load inspectors', error)
  }

  const inspectors: Inspector[] = (data ?? []) as Inspector[]

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <InspectorsManager initialInspectors={inspectors} fetchError={error?.message ?? null} />
      </div>
    </main>
  )
}
