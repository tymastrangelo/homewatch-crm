import { NextResponse, type NextRequest } from 'next/server'
import nodemailer from 'nodemailer'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'
import { COMPANY } from '@/lib/constants'
import { generateReportPdf, formatReportDate } from '@/lib/reportPdf'
import { loadReport, reportFileName } from '@/lib/reportData'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

    const loaded = await loadReport(supabase, id)
    if (!loaded) return NextResponse.json({ error: 'Checklist not found.' }, { status: 404 })
    if ('error' in loaded) return NextResponse.json({ error: loaded.error }, { status: 500 })
    const { report, photos, clientEmail } = loaded

    const recipientEmail = requestedEmail || clientEmail
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

    const pdfBuffer = await generateReportPdf(report, photos)

    const visitLabel = formatReportDate(report.visitDate)
    const subject = `Home Watch Report — ${report.propertyAddress} (${visitLabel})`

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
      attachments: [{ filename: reportFileName(report.propertyAddress), content: pdfBuffer }]
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
    revalidatePath('/')
    revalidatePath('/checklists')

    return NextResponse.json({ ok: true, sentTo: recipientEmail, sentAt })
  } catch (error) {
    console.error('Email route failed', error)
    const message = error instanceof Error ? error.message : 'Failed to email the checklist.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
