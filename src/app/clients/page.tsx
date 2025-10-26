import ClientsManager from '@/components/ClientsManager'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import type { Client, Property } from '@/lib/supabaseClient'

export const revalidate = 0

type PropertySummary = Pick<Property, 'id' | 'name' | 'address' | 'created_at' | 'updated_at'>

type ClientWithRelations = Client & {
  properties: PropertySummary[]
}

type RawClientRecord = Client & {
  properties: (PropertySummary | null)[] | null
}

export default async function ClientsPage() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('clients')
    .select('id, user_id, name, phone, email, created_at, updated_at, properties:properties(id, name, address, created_at, updated_at)')
    .order('name', { ascending: true })

  if (error) {
    console.error('Failed to load clients', error)
  }

  const clients: ClientWithRelations[] = ((data ?? []) as unknown as RawClientRecord[]).map(rawClient => {
    const properties = Array.isArray(rawClient.properties)
      ? rawClient.properties
          .filter((property): property is PropertySummary => property !== null)
          .map(property => ({
            id: property.id,
            name: property.name,
            address: property.address,
            created_at: property.created_at,
            updated_at: property.updated_at
          }))
      : []

    return {
      id: rawClient.id,
      user_id: rawClient.user_id,
      name: rawClient.name,
      phone: rawClient.phone,
      email: rawClient.email,
      created_at: rawClient.created_at,
      updated_at: rawClient.updated_at,
      properties
    }
  })

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <ClientsManager initialClients={clients} fetchError={error?.message ?? null} />
      </div>
    </main>
  )
}
