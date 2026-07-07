import path from 'node:path'
import { promises as fs } from 'node:fs'
import { createRequire } from 'node:module'
import { PDFKIT_STANDARD_FONT_DATA } from './pdfkitStandardFontData'
import { COMPANY } from './constants'
import { CATEGORY_ORDER, categoryLabel } from './checklistTemplate'
import type { ChecklistItemStatus } from './types'

/**
 * Themed PDF report generator for home watch inspections. Pure module: no
 * Supabase imports, so the email route, the download route, and local mock
 * scripts can all drive the exact same renderer.
 */

export type ReportPhoto = { buffer: Buffer; itemLabel: string; note?: string | null }

export type ReportItem = {
  label: string
  category: string
  status: ChecklistItemStatus
  notes: string | null
  sortOrder: number
}

export type Report = {
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

// ---------------------------------------------------------------------------
// Theme — mirrors the app's brand: navy ink, sky-blue keyline, status colors.
// ---------------------------------------------------------------------------
const T = {
  navy: '#16233b',
  navySoft: '#2f4a69',
  sky: '#89b4d8',
  skyDeep: '#5781a5',
  skyWash: '#eef4fa',
  paper: '#f6f8fa',
  ink: '#1f2937',
  inkSoft: '#6b7280',
  line: '#dbe3ec',
  ok: '#15803d',
  okWash: '#e9f6ee',
  issue: '#b91c1c',
  issueWash: '#fdeeee',
  na: '#64748b',
  naWash: '#eef1f5',
  unchecked: '#b45309',
  uncheckedWash: '#fdf4e7'
} as const

const STATUS_THEME: Record<ChecklistItemStatus, { label: string; color: string; wash: string }> = {
  done: { label: 'OK', color: T.ok, wash: T.okWash },
  issue: { label: 'ISSUE', color: T.issue, wash: T.issueWash },
  na: { label: 'N/A', color: T.na, wash: T.naWash },
  unchecked: { label: 'NOT CHECKED', color: T.unchecked, wash: T.uncheckedWash }
}

const MARGIN = 48
const FOOTER_ZONE = 46

export function formatReportDate(value: string | null) {
  if (!value) return 'Not recorded'
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

// ---------------------------------------------------------------------------
// PDFKit ships its standard-font metric (.afm) files on disk, which Next.js
// does not always trace into a serverless bundle. Patch fs.readFileSync once
// to serve the metrics straight from an embedded constant.
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

type Doc = InstanceType<typeof import('pdfkit')>

function contentWidth(doc: Doc) {
  return doc.page.width - MARGIN * 2
}

/** Page-break guard: starts a new page unless `needed` points still fit. */
function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > doc.page.height - MARGIN - FOOTER_ZONE) {
    doc.addPage()
  }
}

function sectionHeading(doc: Doc, title: string) {
  ensureSpace(doc, 60)
  doc.moveDown(1.2)
  const y = doc.y
  doc.font('Helvetica-Bold').fontSize(11).fillColor(T.navy)
  doc.text(title.toUpperCase(), MARGIN, y, { characterSpacing: 1.2 })
  const after = doc.y + 4
  doc.moveTo(MARGIN, after).lineTo(MARGIN + contentWidth(doc), after).lineWidth(0.75).strokeColor(T.line).stroke()
  doc
    .moveTo(MARGIN, after)
    .lineTo(MARGIN + 42, after)
    .lineWidth(2)
    .strokeColor(T.sky)
    .stroke()
  doc.y = after + 12
}

function statusPill(doc: Doc, status: ChecklistItemStatus, x: number, y: number, width: number) {
  const { label, color, wash } = STATUS_THEME[status]
  const h = 15
  doc.roundedRect(x, y, width, h, h / 2).fillColor(wash).fill()
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(color)
  doc.text(label, x, y + 4.6, { width, align: 'center', characterSpacing: 0.6 })
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
export async function generateReportPdf(report: Report, photos: ReportPhoto[], logo?: Buffer | null): Promise<Buffer> {
  ensureStandardFonts()
  const { default: PDFDocument } = await import('pdfkit')

  if (logo === undefined) {
    try {
      logo = await fs.readFile(path.join(process.cwd(), 'public', 'logo.png'))
    } catch {
      logo = null
    }
  }

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: {
        Title: `Home Watch Inspection Report — ${report.propertyAddress}`,
        Author: COMPANY.name
      }
    })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const cw = contentWidth(doc)

    // ---- Header band -------------------------------------------------------
    // Navy band with sky keyline: the signature element shared with the app.
    const bandH = 108
    doc.rect(0, 0, doc.page.width, bandH).fillColor(T.navy).fill()
    doc.rect(0, bandH, doc.page.width, 3).fillColor(T.sky).fill()

    if (logo) {
      try {
        // White plate so the dark-on-white logo reads on the navy band.
        doc.roundedRect(MARGIN, 22, 118, 64, 8).fillColor('#ffffff').fill()
        doc.image(logo, MARGIN + 8, 30, { fit: [102, 48], align: 'center', valign: 'center' })
      } catch {
        /* ignore bad logo data */
      }
    }

    const headX = logo ? MARGIN + 138 : MARGIN
    doc.font('Helvetica').fontSize(8.5).fillColor(T.sky)
    doc.text('HOME WATCH INSPECTION REPORT', headX, 30, { characterSpacing: 2 })
    doc.font('Helvetica-Bold').fontSize(19).fillColor('#ffffff')
    doc.text(report.propertyAddress, headX, 44, { width: doc.page.width - headX - MARGIN, height: 44, ellipsis: true })
    doc.font('Helvetica').fontSize(9.5).fillColor('#c8d8ea')
    doc.text(`Visit of ${formatReportDate(report.visitDate)}`, headX, doc.y + 3)

    doc.y = bandH + 24

    // ---- Visit details panel ----------------------------------------------
    const details: [string, string][] = [
      ['CLIENT', report.clientName || '—'],
      ['INSPECTOR', report.inspectorName || '—'],
      ['PROPERTY', report.propertyAddress || '—'],
      ['VISIT DATE', formatReportDate(report.visitDate)]
    ]
    if (report.clientPhone) details.push(['CLIENT PHONE', report.clientPhone])
    if (report.clientEmail) details.push(['CLIENT EMAIL', report.clientEmail])

    const colW = cw / 2
    const rowH = 30
    const rows = Math.ceil(details.length / 2)
    const panelY = doc.y
    doc.roundedRect(MARGIN, panelY, cw, rows * rowH + 14, 8).fillColor(T.skyWash).fill()
    details.forEach(([label, value], i) => {
      const x = MARGIN + 14 + (i % 2) * colW
      const y = panelY + 12 + Math.floor(i / 2) * rowH
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(T.skyDeep)
      doc.text(label, x, y, { characterSpacing: 1 })
      doc.font('Helvetica').fontSize(10).fillColor(T.ink)
      doc.text(value, x, y + 8, { width: colW - 28, height: 14, ellipsis: true })
    })
    doc.y = panelY + rows * rowH + 14 + 18

    // ---- Summary tiles ------------------------------------------------------
    const tiles = [
      { n: report.counts.done, label: 'CHECKED OK', color: T.ok },
      { n: report.counts.issue, label: report.counts.issue === 1 ? 'ISSUE FOUND' : 'ISSUES FOUND', color: report.counts.issue > 0 ? T.issue : T.inkSoft },
      { n: report.counts.na, label: 'NOT APPLICABLE', color: T.na },
      { n: report.items.length, label: 'POINTS INSPECTED', color: T.navy }
    ]
    const gap = 10
    const tileW = (cw - gap * (tiles.length - 1)) / tiles.length
    const tileH = 52
    const tilesY = doc.y
    tiles.forEach((tile, i) => {
      const x = MARGIN + i * (tileW + gap)
      doc.roundedRect(x, tilesY, tileW, tileH, 8).lineWidth(1).strokeColor(T.line).stroke()
      doc.rect(x, tilesY + tileH - 3, tileW, 3).fillColor(tile.color).fill()
      doc.font('Helvetica-Bold').fontSize(20).fillColor(tile.color)
      doc.text(String(tile.n), x, tilesY + 9, { width: tileW, align: 'center' })
      doc.font('Helvetica-Bold').fontSize(6).fillColor(T.inkSoft)
      doc.text(tile.label, x, tilesY + 34, { width: tileW, align: 'center', characterSpacing: 0.8 })
    })
    doc.y = tilesY + tileH

    // ---- Temperatures -------------------------------------------------------
    if (report.temps.length > 0) {
      sectionHeading(doc, 'Interior temperatures')
      const tGap = 10
      const tW = (cw - tGap * 3) / 4
      const tY = doc.y
      report.temps.slice(0, 4).forEach((t, i) => {
        const x = MARGIN + i * (tW + tGap)
        doc.roundedRect(x, tY, tW, 40, 8).fillColor(T.paper).fill()
        doc.font('Helvetica-Bold').fontSize(6.5).fillColor(T.inkSoft)
        doc.text(t.label.toUpperCase(), x, tY + 8, { width: tW, align: 'center', characterSpacing: 0.5 })
        doc.font('Helvetica-Bold').fontSize(13).fillColor(T.navy)
        doc.text(t.value, x, tY + 19, { width: tW, align: 'center' })
      })
      doc.y = tY + 40
    }

    // ---- Checklist by category ---------------------------------------------
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

    const pillW = 74
    const labelW = cw - pillW - 14

    orderedKeys.forEach(key => {
      const list = (grouped.get(key) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder)
      sectionHeading(doc, categoryLabel(key))

      list.forEach((item, idx) => {
        const isIssue = item.status === 'issue'

        // Measure first, then draw: the row's full height (label + notes +
        // padding) is known up front so the wash, text, and page breaks agree.
        doc.font('Helvetica').fontSize(9.5)
        const labelH = Math.max(doc.heightOfString(item.label, { width: labelW }), 15)
        const notesH = item.notes
          ? doc.font('Helvetica-Oblique').fontSize(8.5).heightOfString(item.notes, { width: labelW - 10 }) + 5
          : 0
        const padY = isIssue ? 9 : 6
        const rowH = labelH + notesH + padY * 2
        ensureSpace(doc, rowH + (isIssue ? 12 : 2))

        if (isIssue) doc.y += 5 // breathing room so the wash clears the row above
        const top = doc.y
        if (isIssue) {
          doc.roundedRect(MARGIN - 8, top, cw + 16, rowH, 7).fillColor(T.issueWash).fill()
        }

        const textY = top + padY
        doc.font('Helvetica').fontSize(9.5).fillColor(T.ink)
        doc.text(item.label, MARGIN, textY, { width: labelW })
        statusPill(doc, item.status, MARGIN + cw - pillW, textY, pillW)
        if (item.notes) {
          doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(isIssue ? T.issue : T.inkSoft)
          doc.text(item.notes, MARGIN + 10, textY + labelH + 5, { width: labelW - 10 })
        }

        doc.y = top + rowH
        if (isIssue) {
          doc.y += 5 // symmetric gap below the wash
        } else if (idx < list.length - 1 && list[idx + 1].status !== 'issue') {
          // Hairline only between two plain rows — washes separate themselves.
          doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + cw, doc.y).lineWidth(0.5).strokeColor('#edf1f5').stroke()
        }
      })
    })

    // ---- Inspector comments --------------------------------------------------
    if (report.comments) {
      sectionHeading(doc, 'Inspector comments')
      doc.font('Helvetica').fontSize(9.5)
      const h = doc.heightOfString(report.comments, { width: cw - 28 }) + 24
      ensureSpace(doc, h)
      const y = doc.y
      doc.roundedRect(MARGIN, y, cw, h, 8).fillColor(T.paper).fill()
      doc.rect(MARGIN, y, 3, h).fillColor(T.sky).fill()
      doc.font('Helvetica').fontSize(9.5).fillColor(T.ink)
      doc.text(report.comments, MARGIN + 16, y + 12, { width: cw - 28 })
      doc.y = y + h
    }

    // ---- Photo appendix -------------------------------------------------------
    if (photos.length > 0) {
      doc.addPage()
      sectionHeading(doc, 'Inspection photos')
      const pGap = 12
      const cellW = (cw - pGap) / 2
      const imgH = 170
      const cellH = imgH + 30

      photos.forEach((photo, i) => {
        const col = i % 2
        if (col === 0) ensureSpace(doc, cellH)
        const x = MARGIN + col * (cellW + pGap)
        const y = doc.y

        doc.save()
        doc.roundedRect(x, y, cellW, imgH, 8).clip()
        doc.rect(x, y, cellW, imgH).fillColor(T.paper).fill()
        try {
          doc.image(photo.buffer, x, y, { cover: [cellW, imgH], align: 'center', valign: 'center' })
        } catch {
          doc.font('Helvetica').fontSize(8).fillColor(T.inkSoft)
          doc.text('Image could not be rendered', x, y + imgH / 2 - 4, { width: cellW, align: 'center' })
        }
        doc.restore()
        doc.roundedRect(x, y, cellW, imgH, 8).lineWidth(1).strokeColor(T.line).stroke()

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(T.navySoft)
        doc.text(photo.itemLabel, x + 2, y + imgH + 6, { width: cellW - 4, height: 18, ellipsis: true })

        if (col === 1 || i === photos.length - 1) {
          doc.y = y + cellH + 6
        } else {
          doc.y = y
        }
      })
    }

    // ---- Footer on every page ---------------------------------------------
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      // Writing below the bottom margin makes pdfkit auto-append a page;
      // zero the margin while stamping the footer to keep it on this page.
      doc.page.margins.bottom = 0
      const y = doc.page.height - 34
      doc.moveTo(MARGIN, y - 8).lineTo(doc.page.width - MARGIN, y - 8).lineWidth(0.5).strokeColor(T.line).stroke()
      doc.font('Helvetica').fontSize(7.5).fillColor(T.inkSoft)
      doc.text(`${COMPANY.name}  ·  ${COMPANY.phone}  ·  ${COMPANY.email}`, MARGIN, y, { lineBreak: false })
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN, y, { width: cw, align: 'right', lineBreak: false })
    }

    doc.end()
  })
}
