import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import { generateReportPdf } from '@/lib/reportPdf'
import { loadReport, reportFileName } from '@/lib/reportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * GET /api/checklists/[id]/pdf — the same report the email route attaches,
 * served inline so staff can preview or download it without sending anything.
 * Append ?download=1 to force a file download instead of inline preview.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'Invalid checklist id.' }, { status: 400 })

  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

    const loaded = await loadReport(supabase, id)
    if (!loaded) return NextResponse.json({ error: 'Checklist not found.' }, { status: 404 })
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: 500 })

    const pdfBuffer = await generateReportPdf(loaded.report, loaded.photos)
    const download = request.nextUrl.searchParams.get('download') === '1'
    const filename = reportFileName(loaded.report.propertyAddress)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('PDF route failed', error)
    const message = error instanceof Error ? error.message : 'Failed to generate the PDF.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
