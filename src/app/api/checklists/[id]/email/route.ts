import path from 'node:path'
import { promises as fs } from 'node:fs'
import { NextResponse, type NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import type { Checklist, ChecklistItem, ChecklistPhoto, Client, Property } from '@/lib/supabaseClient'
import type { ChecklistItemStatus } from '@/lib/types'

export const runtime = 'nodejs'

type ChecklistMeta = {
  clientId?: string
  propertyId?: string
  clientName?: string
  address?: string
  inspector?: string
  inspectorId?: string | null
  inspectorEmail?: string | null
  inspectorPhone?: string | null
  phone?: string
  email?: string
  comments?: string | null
  itemSummary?: string
  garageTemp?: string | null
  mainFloorTemp?: string | null
  secondFloorTemp?: string | null
  thirdFloorTemp?: string | null
  emailSentAt?: string | null
  emailSentTo?: string | null
  temperatures?: {
    garage?: string | null
    mainFloor?: string | null
    secondFloor?: string | null
    thirdFloor?: string | null
  }
}

type ChecklistPhotoRecord = Pick<ChecklistPhoto, 'id' | 'storage_path'> & {
  storage_path: string | null
}

type ChecklistItemWithMeta = ChecklistItem & {
  category: string | null
  item_text: string
  status: ChecklistItemStatus | null
  notes: string | null
  checklist_photos?: ChecklistPhotoRecord[]
}

type PropertyWithClient = Property & {
  client: Client | null
}

type ChecklistWithRelations = Checklist & {
  properties: PropertyWithClient | null
  checklist_items: ChecklistItemWithMeta[]
}

const COMPANY_PHONE = '239.572.2025'
const COMPANY_PRIMARY_EMAIL = 'info@239homeservices.com'
const COMPANY_SECONDARY_EMAIL = 'info@239homeservices.com'

const STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  done: 'DONE',
  issue: 'ISSUE',
  na: 'N/A',
  unchecked: 'UNCHECKED'
}

const CATEGORY_ORDER = ['exterior', 'interior', 'security', 'lanai_pool', 'final']

function parseMeta(notes: string | null): ChecklistMeta {
  if (!notes) return {}
  try {
    return JSON.parse(notes) as ChecklistMeta
  } catch (error) {
    console.error('Failed to parse checklist metadata for email generation', error)
    return {}
  }
}

function resolveTemperature(meta: ChecklistMeta, key: keyof NonNullable<ChecklistMeta['temperatures']>) {
  const fallbackKey =
    key === 'garage'
      ? 'garageTemp'
      : key === 'mainFloor'
        ? 'mainFloorTemp'
        : key === 'secondFloor'
          ? 'secondFloorTemp'
          : 'thirdFloorTemp'

  const primary = meta.temperatures?.[key]
  if (primary && primary.trim() !== '') {
    return primary
  }

  const fallback = (meta as Record<string, string | null | undefined>)[fallbackKey]
  if (typeof fallback === 'string' && fallback.trim() !== '') {
    return fallback
  }

  return null
}

function formatCategoryLabel(value: string | null) {
  if (!value) return 'General'
  if (value === 'lanai_pool') return 'Lanai / Pool'
  return value
    .split('_')
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

type SupabaseClientInstance = Awaited<ReturnType<typeof createSupabaseServerClient>>

type DownloadedAttachment = {
  filename: string
  buffer: Buffer
  contentType?: string
}

type PhotoAttachment = DownloadedAttachment & {
  categoryKey: string
  categoryLabel: string
  itemLabel: string
}

const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.pdf': 'application/pdf'
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function sanitizeExtension(ext: string) {
  if (!ext) return ''
  const normalized = ext.startsWith('.') ? ext.substring(1) : ext
  const cleaned = normalized.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  return cleaned ? `.${cleaned}` : ''
}

function extensionFromMime(mime?: string | null) {
  if (!mime) return ''
  const normalized = mime.toLowerCase()
  const entry = Object.entries(EXTENSION_TO_MIME).find(([, value]) => value === normalized)
  return entry ? entry[0] : ''
}

function inferContentType(filename: string, explicit?: string | null) {
  if (explicit && explicit.trim() !== '') {
    return explicit
  }

  const extension = sanitizeExtension(path.extname(filename))
  if (extension && EXTENSION_TO_MIME[extension]) {
    return EXTENSION_TO_MIME[extension]
  }

  return undefined
}

function buildFilename(rawName: string | null | undefined, fallbackBase: string, mimeHint?: string | null) {
  const extFromName = sanitizeExtension(path.extname(rawName ?? ''))
  const baseName = rawName ? rawName.slice(0, rawName.length - (extFromName ? extFromName.length : 0)) : ''
  const sanitizedBase = sanitizeSegment(baseName)
  const base = sanitizedBase || sanitizeSegment(fallbackBase) || 'file'
  const fallbackExt = sanitizeExtension(extensionFromMime(mimeHint)) || '.jpg'
  const extension = extFromName || fallbackExt
  return `${base}${extension}`
}

function ensureUniqueFilename(name: string, seen: Set<string>) {
  if (!seen.has(name)) {
    seen.add(name)
    return name
  }

  const extension = sanitizeExtension(path.extname(name)) || ''
  const base = sanitizeSegment(extension ? name.slice(0, name.length - extension.length) : name) || 'file'

  let counter = 2
  let candidate = `${base}-${counter}${extension}`
  while (seen.has(candidate)) {
    counter += 1
    candidate = `${base}-${counter}${extension}`
  }

  seen.add(candidate)
  return candidate
}

async function resolvePhotoAttachment(
  supabase: SupabaseClientInstance,
  storagePath: string,
  fallbackBase: string
): Promise<DownloadedAttachment | null> {
  if (!storagePath) {
    return null
  }

  if (/^https?:\/\//i.test(storagePath)) {
    try {
      const response = await fetch(storagePath)
      if (!response.ok) {
        console.warn('Failed to fetch external checklist photo', { storagePath, status: response.status })
        return null
      }

      const arrayBuffer = await response.arrayBuffer()
      const url = new URL(storagePath)
      const rawName = decodeURIComponent(url.pathname.split('/').pop() ?? '')
      const filename = buildFilename(rawName, fallbackBase, response.headers.get('content-type'))

      return {
        filename,
        buffer: Buffer.from(arrayBuffer),
        contentType: inferContentType(filename, response.headers.get('content-type'))
      }
    } catch (error) {
      console.warn('Failed to download external checklist photo', { storagePath, error })
      return null
    }
  }

  const [bucket, ...objectParts] = storagePath.split('/')
  if (!bucket || objectParts.length === 0) {
    console.warn('Checklist photo storage path is malformed', { storagePath })
    return null
  }

  const objectPath = objectParts.join('/')
  const { data, error } = await supabase.storage.from(bucket).download(objectPath)
  if (error || !data) {
    console.warn('Failed to download checklist photo from storage', { storagePath, error })
    return null
  }

  const arrayBuffer = await data.arrayBuffer()
  const rawName = decodeURIComponent(objectParts[objectParts.length - 1] ?? '')
  const filename = buildFilename(rawName, fallbackBase, data.type)

  return {
    filename,
    buffer: Buffer.from(arrayBuffer),
    contentType: inferContentType(filename, data.type)
  }
}

async function collectPhotoAttachments(
  supabase: SupabaseClientInstance,
  items: ChecklistItemWithMeta[]
): Promise<PhotoAttachment[]> {
  if (!items || items.length === 0) {
    return []
  }

  const tasks: Array<Promise<{
    attachment: DownloadedAttachment | null
    fallbackBase: string
    categoryKey: string
    itemLabel: string
  }>> = []

  items.forEach((item, itemIndex) => {
  const categoryKey = item.category ?? 'general'
  const itemLabel = item.item_text || 'Checklist item'

    ;(item.checklist_photos ?? []).forEach((photo, photoIndex) => {
      if (!photo?.storage_path) {
        return
      }

      const fallbackBase = `photo-${itemIndex + 1}-${photoIndex + 1}`

      tasks.push(
        resolvePhotoAttachment(supabase, photo.storage_path, fallbackBase).then(attachment => ({
          attachment,
          fallbackBase,
          categoryKey,
          itemLabel
        }))
      )
    })
  })

  if (tasks.length === 0) {
    return []
  }

  const results = await Promise.all(tasks)
  const seen = new Set<string>()
  const attachments: PhotoAttachment[] = []

  results.forEach(({ attachment, fallbackBase, categoryKey, itemLabel }) => {
    if (!attachment) {
      return
    }

  const baseName = attachment.filename || buildFilename('', fallbackBase, attachment.contentType)
  const uniqueName = ensureUniqueFilename(baseName, seen)
    attachments.push({
      filename: uniqueName,
      buffer: attachment.buffer,
      contentType: attachment.contentType ?? inferContentType(uniqueName, attachment.contentType),
      categoryKey,
      categoryLabel: formatCategoryLabel(categoryKey),
      itemLabel
    })
  })

  return attachments
}

async function generateChecklistPdf({
  checklist,
  meta,
  property,
  items,
  photos = []
}: {
  checklist: ChecklistWithRelations
  meta: ChecklistMeta
  property: PropertyWithClient | null
  items: ChecklistItemWithMeta[]
  photos?: PhotoAttachment[]
}): Promise<Buffer> {
  const { default: PDFDocument } = await import('pdfkit')
  let logoBuffer: Buffer | null = null

  try {
    const file = await fs.readFile(path.join(process.cwd(), 'public', 'logo.png'))
    logoBuffer = file
  } catch (error) {
    console.warn('Checklist PDF logo could not be read from public/logo.png', error)
  }

  const clientName = meta.clientName ?? property?.client?.name ?? property?.name ?? 'Not specified'
  const propertyAddress = meta.address ?? property?.address ?? 'Not provided'
  const inspector = meta.inspector ?? 'Not recorded'
  const visitDate = checklist.visit_date ?? checklist.created_at
  const companyPhone = COMPANY_PHONE
  const companyEmail = COMPANY_PRIMARY_EMAIL
  const comments = meta.comments ?? ''
  const clientPhone = meta.phone ?? property?.client?.phone ?? ''
  const clientEmail = meta.email ?? property?.client?.email ?? ''

  const temperatures = {
    garage: resolveTemperature(meta, 'garage'),
    mainFloor: resolveTemperature(meta, 'mainFloor'),
    secondFloor: resolveTemperature(meta, 'secondFloor'),
    thirdFloor: resolveTemperature(meta, 'thirdFloor')
  }

  const grouped = new Map<string, ChecklistItemWithMeta[]>()
  items.forEach(item => {
    const categoryKey = item.category ?? 'general'
    const existing = grouped.get(categoryKey)
    if (existing) {
      existing.push(item)
    } else {
      grouped.set(categoryKey, [item])
    }
  })

  const orderedCategories = [
    ...CATEGORY_ORDER,
    ...Array.from(grouped.keys()).filter(key => !CATEGORY_ORDER.includes(key))
  ].filter(key => grouped.has(key))

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 50 })
    const chunks: Buffer[] = []

    const getContentWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right
    const drawCenteredImage = (imageBuffer: Buffer, widthLimit: number, heightLimit: number, padding = 16) => {
      const contentWidth = getContentWidth()
      const maxWidth = Math.min(contentWidth, widthLimit)
      let targetWidth = maxWidth
      let targetHeight = heightLimit
      let xPosition = doc.page.margins.left + (contentWidth - targetWidth) / 2

      try {
        const image = (doc as unknown as { openImage?: (source: Buffer) => { width: number; height: number } }).openImage?.(imageBuffer)
        if (image && typeof image.width === 'number' && typeof image.height === 'number' && image.width > 0 && image.height > 0) {
          const scale = Math.min(maxWidth / image.width, heightLimit / image.height, 1)
          targetWidth = image.width * scale
          targetHeight = image.height * scale
          xPosition = doc.page.margins.left + (contentWidth - targetWidth) / 2
        }
      } catch {
        // Ignore metadata lookup failures and fall back to default sizing
      }

      const yPosition = doc.y
      doc.image(imageBuffer, xPosition, yPosition, { width: targetWidth })
      doc.y = yPosition + targetHeight + padding
    }

    doc.on('data', (...args: unknown[]) => {
      const [chunk] = args
      if (chunk instanceof Buffer) {
        chunks.push(chunk)
        return
      }

      if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk))
        return
      }

      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk))
      }
    })

    doc.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    doc.on('error', reject)

    const topMargin = doc.page.margins.top

    if (logoBuffer) {
      try {
        doc.y = Math.max(doc.y, topMargin)
        drawCenteredImage(logoBuffer, 220, 90, 18)
      } catch (error) {
        console.warn('Checklist PDF failed to embed logo image', error)
        doc.y = Math.max(doc.y, topMargin)
      }
    } else {
      doc.y = Math.max(doc.y, topMargin)
    }

    doc.moveDown(0.5)

    doc.fontSize(18).fillColor('#000000').text('Basic Home Watch Checklist', { align: 'center' })
    doc.moveDown(0.4)

    doc
      .fontSize(10)
      .fillColor('#000000')
      .text('PROPERTY INSPECTIONS & SERVICES', { align: 'center' })
      .text(`Phone: ${companyPhone}`, { align: 'center' })
      .text(`Email: ${companyEmail}`, { align: 'center' })

    doc.moveDown(0.75)

    doc.fontSize(12)
      .text(`Client Name: ${clientName}`)
      .text(`Address: ${propertyAddress}`)
      .text(`Date of Arrival: ${visitDate ? new Date(visitDate).toLocaleDateString() : 'Not recorded'}`)
      .text(`Inspector: ${inspector}`)
    if (clientPhone) {
      doc.text(`Client Phone: ${clientPhone}`)
    }
    if (clientEmail) {
      doc.text(`Client Email: ${clientEmail}`)
    }
    doc.moveDown()

    doc.fontSize(11).text('Exterior / Interior Checklist')
    doc.moveDown(0.25)
    doc.fontSize(9).text('Visual review and ensure mechanicals are in working order. Status values: DONE, ISSUE, N/A, UNCHECKED.')
    doc.moveDown()

    orderedCategories.forEach(categoryKey => {
      const categoryItems = (grouped.get(categoryKey) ?? []).slice().sort((a, b) => a.item_text.localeCompare(b.item_text))
      doc.fontSize(12).text(formatCategoryLabel(categoryKey), { underline: true })
      doc.moveDown(0.25)
      categoryItems.forEach(item => {
        const status = (item.status ?? 'unchecked') as ChecklistItemStatus
        doc.fontSize(10).fillColor('#000000').text(`[${STATUS_LABELS[status]}] ${item.item_text}`)
        if (item.notes) {
          doc.fontSize(9).fillColor('#555555').text(`Notes: ${item.notes}`, { indent: 12 })
        }
        doc.moveDown(0.2)
      })
      doc.moveDown(0.5)
    })

    const hasTemperatures = Object.values(temperatures).some(value => value && value.trim() !== '')
    if (hasTemperatures) {
      doc.fontSize(12).fillColor('#000000').text('Interior Temperature Levels', { underline: true })
      doc.moveDown(0.25)
      doc.fontSize(10)
        .text(`Garage / Storage: ${temperatures.garage ?? 'Not recorded'}`)
        .text(`Main Floor: ${temperatures.mainFloor ?? 'Not recorded'}`)
        .text(`2nd Floor / 2nd Zone: ${temperatures.secondFloor ?? 'Not recorded'}`)
        .text(`3rd Floor: ${temperatures.thirdFloor ?? 'Not recorded'}`)
      doc.moveDown(0.75)
    }

    doc.fontSize(12).fillColor('#000000').text('Comments and Photos', { underline: true })
    doc.moveDown(0.15)
    doc.fontSize(9).fillColor('#555555').text(
      `PROPERTY INSPECTIONS & SERVICES — Phone: ${COMPANY_PHONE} — Email: ${COMPANY_SECONDARY_EMAIL}`
    )
    doc.moveDown(0.25)
    doc.fontSize(10).fillColor('#000000').text(comments || 'None provided.', {
      align: 'left'
    })

    if (photos.length > 0) {
      const renderPhotosHeader = () => {
        doc.fontSize(16).fillColor('#000000').text('Inspection Photos', { align: 'center' })
        doc.moveDown(0.75)
      }

      const ensureSpace = (required: number) => {
        const bottom = doc.page.height - doc.page.margins.bottom
        if (doc.y + required > bottom) {
          doc.addPage()
          renderPhotosHeader()
        }
      }

      doc.addPage()
      renderPhotosHeader()

      const photosByCategory = new Map<string, PhotoAttachment[]>()
      photos.forEach(photo => {
        const key = photo.categoryKey || 'general'
        const existing = photosByCategory.get(key)
        if (existing) {
          existing.push(photo)
        } else {
          photosByCategory.set(key, [photo])
        }
      })

      const orderedPhotoCategoryKeys = [
        ...CATEGORY_ORDER,
        ...Array.from(photosByCategory.keys()).filter(key => !CATEGORY_ORDER.includes(key))
      ].filter(key => photosByCategory.has(key))

      orderedPhotoCategoryKeys.forEach(categoryKey => {
        const categoryPhotos = photosByCategory.get(categoryKey)
        if (!categoryPhotos || categoryPhotos.length === 0) {
          return
        }

        ensureSpace(80)

        const categoryLabel = categoryPhotos[0]?.categoryLabel ?? formatCategoryLabel(categoryKey)
        doc.fontSize(13).fillColor('#000000').text(categoryLabel, { underline: true })
        doc.moveDown(0.4)

        const photosByItem = new Map<string, PhotoAttachment[]>()
        categoryPhotos.forEach(photo => {
          const itemKey = photo.itemLabel || 'Checklist Item'
          const existing = photosByItem.get(itemKey)
          if (existing) {
            existing.push(photo)
          } else {
            photosByItem.set(itemKey, [photo])
          }
        })

        photosByItem.forEach((assets, itemLabel) => {
          ensureSpace(60)
          doc.fontSize(11).fillColor('#000000').text(itemLabel)
          doc.moveDown(0.25)

          assets.forEach(asset => {
            ensureSpace(340)
            try {
              drawCenteredImage(asset.buffer, getContentWidth(), 300, 18)
            } catch (error) {
              console.warn('Checklist PDF failed to embed inspection photo', { filename: asset.filename, error })
              doc.fillColor('#b91c1c').fontSize(9).text('Unable to display this photo in the PDF.')
              doc.moveDown(0.5)
              doc.fillColor('#000000')
            }
          })

          doc.moveDown(0.35)
        })

        doc.moveDown(0.65)
      })
    }

    doc.end()
  })
}

type RouteContext = { params: { id: string } } | { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params

  let payload: { email?: string } = {}
  try {
    payload = await request.json()
  } catch {
    payload = {}
  }

  const requestedEmail = typeof payload.email === 'string' ? payload.email.trim() : ''

  try {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('checklists')
      .select(`
        id,
        notes,
        visit_date,
        created_at,
        properties:properties!checklists_property_id_fkey (
          id,
          name,
          address,
          client_id,
          client:clients!properties_client_id_fkey (
            id,
            name,
            email,
            phone
          )
        ),
        checklist_items (
          id,
          category,
          item_text,
          status,
          notes,
          checklist_photos (
            id,
            storage_path
          )
        )
      `)
      .eq('id', id)
      .maybeSingle<ChecklistWithRelations>()

    if (error) {
      console.error('Failed to load checklist for email', error)
      return NextResponse.json({ error: 'Unable to load checklist data.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Checklist not found.' }, { status: 404 })
    }

  const checklist = data
  let meta = parseMeta(checklist.notes)
    const property = checklist.properties
    const recipientEmail = requestedEmail || meta.email || property?.client?.email

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

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !emailFrom) {
      return NextResponse.json(
        {
          error:
            'Email sending is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM environment variables.'
        },
        { status: 500 }
      )
    }

    const checklistItems = checklist.checklist_items ?? []
    const photoAttachments = await collectPhotoAttachments(supabase, checklistItems)
    const isImageAttachment = (attachment: PhotoAttachment) => {
      if (attachment.contentType && attachment.contentType.toLowerCase().startsWith('image/')) {
        return true
      }

      return /\.(?:png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(attachment.filename)
    }

    const imageAttachments = photoAttachments.filter(isImageAttachment)
    const nonImageAttachments = photoAttachments.filter(attachment => !isImageAttachment(attachment))

    const pdfBuffer = await generateChecklistPdf({
      checklist,
      meta,
      property,
      items: checklistItems,
      photos: imageAttachments
    })

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })

    const clientName = meta.clientName ?? property?.client?.name ?? property?.name ?? 'Client'
    const visitDateValue = checklist.visit_date ?? checklist.created_at
    const formattedDate = visitDateValue ? new Date(visitDateValue).toLocaleDateString() : ''
    const subjectSegments = ['Home Watch Checklist']
    if (clientName) subjectSegments.push(clientName)
    if (formattedDate) subjectSegments.push(formattedDate)

    const subject = subjectSegments.join(' – ')
    const bodyLines = [
      'Attached is the completed Home Watch Checklist.',
      '',
      `Client: ${clientName || 'Not specified'}`,
      `Property: ${meta.address ?? property?.address ?? 'Not specified'}`,
      `Visit date: ${formattedDate || 'Not recorded'}`
    ]

    const clientPhoneContact = meta.phone ?? property?.client?.phone
    const clientEmailContact = meta.email ?? property?.client?.email

    if (clientPhoneContact) {
      bodyLines.push(`Client phone: ${clientPhoneContact}`)
    }

    if (clientEmailContact) {
      bodyLines.push(`Client email: ${clientEmailContact}`)
    }

    if (imageAttachments.length > 0) {
      bodyLines.push('', 'Inspection photos are included in the attached PDF report.')
    }

    const clientSlug = clientName ? sanitizeSegment(clientName) : ''
    const formattedDateSlug = formattedDate ? sanitizeSegment(formattedDate.replace(/\//g, '-')) : ''
    const pdfFilename = buildFilename(
      `Checklist-${clientSlug || 'Client'}-${formattedDateSlug || 'Visit'}.pdf`,
      'checklist-report',
      'application/pdf'
    )

    const attachments = [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf'
      },
      ...nonImageAttachments.map(photo => ({
        filename: photo.filename,
        content: photo.buffer,
        contentType: photo.contentType
      }))
    ]

    await transporter.sendMail({
      from: emailFrom,
      to: recipientEmail,
      subject,
      text: bodyLines.join('\n'),
      attachments
    })

    const emailSentAtIso = new Date().toISOString()
    const updatedMeta = {
      ...meta,
      emailSentAt: emailSentAtIso,
      emailSentTo: recipientEmail
    }

    const { error: notesUpdateError } = await supabase
      .from('checklists')
      .update({ notes: JSON.stringify(updatedMeta) })
      .eq('id', id)

    if (notesUpdateError) {
      console.error('Failed to record email metadata on checklist', notesUpdateError)
    } else {
      meta = updatedMeta
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to email checklist PDF', error)
    const message = error instanceof Error ? error.message : 'Failed to send checklist email.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
