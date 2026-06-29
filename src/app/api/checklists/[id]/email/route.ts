import path from 'node:path'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import { NextResponse, type NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import { PDFKIT_STANDARD_FONT_DATA } from '@/lib/pdfkitStandardFontData'
import { COMPANY } from '@/lib/constants'
import { CATEGORY_ORDER, categoryLabel, templateSortOrder } from '@/lib/checklistTemplate'
import type { ChecklistItemStatus } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const STATUS_PDF_LABEL: Record<ChecklistItemStatus, string> = {
  done: 'DONE',
  issue: 'ISSUE',
  na: 'N/A',
  unchecked: 'NOT CHECKED'
}

// Cap embedded photos so a visit with dozens of images can't exhaust memory.
const MAX_EMBEDDED_PHOTOS = 24

// ---------------------------------------------------------------------------
// PDFKit ships its standard-font metric (.afm) files on disk, which Next.js
// does not always trace into a serverless bundle. Rather than copy files around
// (fragile), we patch fs.readFileSync once to serve the metrics straight from
// an embedded constant. Self-contained, no build-time file juggling required.
// ---------------------------------------------------------------------------
let fontPatchApplied = false
function ensureStandardFonts() {
  if (fontPatchApplied) return
  try {
    const require = createRequire(import.meta.url)
    const fsCjs = require('fs') as typeof import('fs') & { __homewatchFontPatch?: boolean }
    if (fsCjs.__homewatchFontPatch) {
      fontPatchApplied = true
      return
    }

    const original = fsCjs.readFileSync.bind(fsCjs)
    const cache = new Map<string, Buffer>()

    fsCjs.readFileSync = function patched(file: Parameters<typeof original>[0], options?: Parameters<typeof original>[1]) {
      if (typeof file === 'string' && file.endsWith('.afm')) {
        const name = path.basename(file)
        const embedded = PDFKIT_STANDARD_FONT_DATA[name]
        if (embedded) {
          let buffer = cache.get(name)
          if (!buffer) {
            buffer = Buffer.from(embedded, 'base64')
            cache.set(name, buffer)
          }
          if (typeof options === 'string') return buffer.toString(options as BufferEncoding)
          if (options && typeof options === 'object' && 'encoding' in options && options.encoding) {
            return buffer.toString(options.encoding as BufferEncoding)
          }
          return buffer
        }
      }
      return original(file as never, options as never)
    } as typeof original

    fsCjs.__homewatchFontPatch = true
    fontPatchApplied = true
  } catch (error) {
    console.warn('Could not apply PDFKit font patch; relying on bundled fonts.', error)
    fontPatchApplied = true
  }
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
type ReportPhoto = { buffer: Buffer; itemLabel: string }
type ReportItem = {
  label: string
  category: string
  status: ChecklistItemStatus
  notes: string | null
  sortOrder: number
}
type Report = {
  clientName: string
  propertyAddress: string
  inspectorName: string
  clientPhone: string
  clientEmail: string
  visitDate: string | null
  comments: string
  temps: { label: string; value: string }[]
  items: ReportItem[]
  counts: Record<ChecklistItemStatus, number>
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null
}

const FULL_SELECT = `
  id, visit_date, created_at, comments,
  temp_garage, temp_main_floor, temp_second_floor, temp_third_floor,
  property:properties!checklists_property_id_fkey ( id, name, address,
    client:clients!properties_client_id_fkey ( id, name, phone, email ) ),
  inspector:inspectors!checklists_inspector_id_fkey ( id, name, email, phone ),
  checklist_items ( id, item_key, sort_order, category, item_text, status, notes,
    checklist_photos ( id, storage_path ) )
`

function formatDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

async function downloadPhoto(supabase: any, storagePath: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//i.test(storagePath)) {
      const res = await fetch(storagePath)
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    }
    const [bucket, ...rest] = storagePath.split('/')
    if (!bucket || rest.length === 0) return null
    const { data, error } = await supabase.storage.from(bucket).download(rest.join('/'))
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer())
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
async function generatePdf(report: Report, photos: ReportPhoto[]): Promise<Buffer> {
  ensureStandardFonts()
  const { default: PDFDocument } = await import('pdfkit')

  let logo: Buffer | null = null
  try {
    logo = await fs.readFile(path.join(process.cwd(), 'public', 'logo.png'))
  } catch {
    logo = null
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
    const left = doc.page.margins.left

    // Header
    if (logo) {
      try {
        doc.image(logo, left + contentWidth / 2 - 90, doc.y, { fit: [180, 70], align: 'center' })
        doc.y += 78
      } catch {
        /* ignore */
      }
    }
    doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a293b').text('Home Watch Inspection Report', { align: 'center' })
    doc.font('Helvetica').fontSize(10).fillColor('#555555')
    doc.text(`${COMPANY.name}  ·  ${COMPANY.phone}  ·  ${COMPANY.email}`, { align: 'center' })
    doc.moveDown(1)

    // Details box
    const detailRows: [string, string][] = [
      ['Client', report.clientName],
      ['Property', report.propertyAddress],
      ['Inspector', report.inspectorName],
      ['Visit date', formatDate(report.visitDate)]
    ]
    if (report.clientPhone) detailRows.push(['Phone', report.clientPhone])
    if (report.clientEmail) detailRows.push(['Email', report.clientEmail])

    doc.fontSize(10).fillColor('#111111')
    detailRows.forEach(([label, value]) => {
      const y = doc.y
      doc.font('Helvetica-Bold').text(`${label}:`, left, y, { width: 110, continued: false })
      doc.font('Helvetica').text(value || '—', left + 110, y, { width: contentWidth - 110 })
      doc.moveDown(0.2)
    })
    doc.moveDown(0.5)

    // Summary chips
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#1a293b')
      .text(
        `Summary:  ${report.counts.done} done   ·   ${report.counts.issue} issues   ·   ${report.counts.na} N/A   ·   ${report.items.length} total`
      )
    doc.moveDown(0.5)

    // Temperatures
    if (report.temps.length > 0) {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a293b').text('Interior temperatures')
      doc.font('Helvetica').fontSize(10).fillColor('#111111')
      doc.text(report.temps.map(t => `${t.label}: ${t.value}`).join('     '))
      doc.moveDown(0.6)
    }

    // Checklist grouped by category
    const grouped = new Map<string, ReportItem[]>()
    report.items.forEach(item => {
      const list = grouped.get(item.category) ?? []
      list.push(item)
      grouped.set(item.category, list)
    })
    const orderedKeys = [
      ...CATEGORY_ORDER.filter(k => grouped.has(k)),
      ...Array.from(grouped.keys()).filter(k => !CATEGORY_ORDER.includes(k as never))
    ]

    orderedKeys.forEach(key => {
      const list = (grouped.get(key) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
      if (doc.y > doc.page.height - 120) doc.addPage()
      doc.moveDown(0.3)
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a293b').text(categoryLabel(key))
      doc.moveDown(0.2)
      list.forEach(item => {
        if (doc.y > doc.page.height - 90) doc.addPage()
        const isIssue = item.status === 'issue'
        const y = doc.y
        doc.font('Helvetica-Bold').fontSize(9).fillColor(isIssue ? '#b91c1c' : '#374151')
        doc.text(`[${STATUS_PDF_LABEL[item.status]}]`, left, y, { width: 90 })
        doc.font('Helvetica').fontSize(10).fillColor('#111111')
        doc.text(item.label, left + 95, y, { width: contentWidth - 95 })
        if (item.notes) {
          doc.font('Helvetica-Oblique').fontSize(9).fillColor('#555555')
          doc.text(`Notes: ${item.notes}`, left + 95, doc.y, { width: contentWidth - 95 })
        }
        doc.moveDown(0.3)
      })
    })

    // Comments
    doc.moveDown(0.5)
    if (doc.y > doc.page.height - 120) doc.addPage()
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a293b').text('Inspector comments')
    doc.font('Helvetica').fontSize(10).fillColor('#111111').text(report.comments || 'None provided.', { width: contentWidth })

    // Photos appendix
    if (photos.length > 0) {
      doc.addPage()
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#1a293b').text('Inspection photos', { align: 'center' })
      doc.moveDown(0.5)
      photos.forEach(photo => {
        if (doc.y > doc.page.height - 240) doc.addPage()
        doc.font('Helvetica').fontSize(9).fillColor('#555555').text(photo.itemLabel)
        try {
          doc.image(photo.buffer, { fit: [contentWidth, 280], align: 'center' })
        } catch {
          doc.fillColor('#999999').text('(image could not be rendered)')
        }
        doc.moveDown(0.8)
      })
    }

    doc.end()
  })
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!id) return NextResponse.json({ error: 'Invalid checklist id.' }, { status: 400 })

  let payload: { email?: string } = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }
  const requestedEmail = typeof payload.email === 'string' ? payload.email.trim() : ''

  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user }
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

    const { data, error } = await supabase.from('checklists').select(FULL_SELECT).eq('id', id).maybeSingle()
    if (error) {
      console.error('Email route: failed to load checklist', error)
      return NextResponse.json({ error: 'Unable to load checklist data.' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Checklist not found.' }, { status: 404 })

    const row = data as any
    const property = firstRelation<any>(row.property)
    const client = firstRelation<any>(property?.client)
    const inspector = firstRelation<any>(row.inspector)

    const recipientEmail = requestedEmail || client?.email || ''
    if (!recipientEmail) {
      return NextResponse.json({ error: 'No recipient email is available for this checklist.' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ error: 'Recipient email address is invalid.' }, { status: 400 })
    }

    const smtpHost = process.env.SMTP_HOST
    const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587
    const smtpUser = process.env.SMTP_USER
    const smtpPass = process.env.SMTP_PASS
    const emailFrom = process.env.EMAIL_FROM
    const smtpSecure = process.env.SMTP_SECURE
      ? ['true', '1', 'yes'].includes(process.env.SMTP_SECURE.toLowerCase())
      : smtpPort === 465

    if (!smtpHost || !smtpUser || !smtpPass || !emailFrom) {
      return NextResponse.json(
        { error: 'Email sending is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM.' },
        { status: 500 }
      )
    }

    // Build the report model
    const counts: Record<ChecklistItemStatus, number> = { done: 0, issue: 0, na: 0, unchecked: 0 }
    const items: ReportItem[] = (row.checklist_items ?? []).map((item: any) => {
      const status = (item.status ?? 'unchecked') as ChecklistItemStatus
      if (status in counts) counts[status] += 1
      return {
        label: item.item_text,
        category: item.category || 'general',
        status,
        notes: item.notes,
        sortOrder: item.sort_order ?? templateSortOrder(item.item_key, item.item_text)
      }
    })
    items.sort((a, b) => a.sortOrder - b.sortOrder)

    const temps = [
      ['Garage / Storage', row.temp_garage],
      ['Main floor', row.temp_main_floor],
      ['2nd floor', row.temp_second_floor],
      ['3rd floor', row.temp_third_floor]
    ]
      .filter(([, value]) => value && String(value).trim())
      .map(([label, value]) => ({ label: label as string, value: String(value) }))

    // Collect photos (capped)
    const photos: ReportPhoto[] = []
    outer: for (const item of row.checklist_items ?? []) {
      for (const photo of item.checklist_photos ?? []) {
        if (photos.length >= MAX_EMBEDDED_PHOTOS) break outer
        if (!photo?.storage_path) continue
        const buffer = await downloadPhoto(supabase, photo.storage_path)
        if (buffer) photos.push({ buffer, itemLabel: item.item_text })
      }
    }

    const report: Report = {
      clientName: client?.name || property?.name || 'Not specified',
      propertyAddress: property?.address || 'Not provided',
      inspectorName: inspector?.name || 'Not recorded',
      clientPhone: client?.phone || '',
      clientEmail: client?.email || '',
      visitDate: row.visit_date ?? row.created_at,
      comments: row.comments || '',
      temps,
      items,
      counts
    }

    const pdfBuffer = await generatePdf(report, photos)

    const visitLabel = formatDate(report.visitDate)
    const subject = `Home Watch Report — ${report.propertyAddress} (${visitLabel})`
    const fileSafe = report.propertyAddress.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'inspection'

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass }
    })

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1a293b;line-height:1.5;max-width:560px">
        <h2 style="margin:0 0 4px">${COMPANY.name}</h2>
        <p style="margin:0 0 16px;color:#555">Home Watch Inspection Report</p>
        <p>Hello${report.clientName && report.clientName !== 'Not specified' ? ` ${report.clientName}` : ''},</p>
        <p>Attached is the inspection report for <strong>${report.propertyAddress}</strong> from your visit on <strong>${visitLabel}</strong>.</p>
        <p style="margin:16px 0;padding:12px 16px;background:#f5fafc;border-radius:8px">
          <strong>${report.counts.done}</strong> items completed
          ${report.counts.issue > 0 ? ` · <strong style="color:#b91c1c">${report.counts.issue} issue(s) flagged</strong>` : ''}
        </p>
        <p>If you have any questions, just reply to this email or call us at ${COMPANY.phone}.</p>
        <p style="margin-top:24px;color:#555">— ${COMPANY.name}</p>
      </div>
    `

    const mailOptions = {
      from: emailFrom,
      to: recipientEmail,
      subject,
      html,
      text: `Attached is the home watch inspection report for ${report.propertyAddress} (visit on ${visitLabel}). ${report.counts.done} items completed${report.counts.issue > 0 ? `, ${report.counts.issue} issue(s) flagged` : ''}. — ${COMPANY.name}, ${COMPANY.phone}`,
      attachments: [{ filename: `home-watch-report-${fileSafe}.pdf`, content: pdfBuffer }]
    }
    await transporter.sendMail(mailOptions)

    // Record the send on real columns.
    const sentAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('checklists')
      .update({ email_sent_at: sentAt, email_sent_to: recipientEmail })
      .eq('id', id)
    if (updateError) console.warn('Email sent but failed to record status', updateError)

    revalidatePath(`/checklists/${id}`)
    revalidatePath('/dashboard')
    revalidatePath('/checklists')

    return NextResponse.json({ ok: true, sentTo: recipientEmail, sentAt })
  } catch (error) {
    console.error('Email route failed', error)
    const message = error instanceof Error ? error.message : 'Failed to email the checklist.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
