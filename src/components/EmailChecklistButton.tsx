'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type EmailChecklistButtonProps = {
  checklistId: string
  recipientEmail?: string
  clientName?: string
  propertyAddress?: string
  visitDate?: string | null
  alreadySentAt?: string | null
}

type FeedbackState = {
  type: 'success' | 'error'
  message: string
}

function formatContextLine(clientName?: string, propertyAddress?: string, visitDate?: string | null) {
  const parts: string[] = []
  if (clientName) parts.push(clientName)
  if (propertyAddress) parts.push(propertyAddress)
  if (visitDate) {
    const parsed = new Date(visitDate)
    if (!Number.isNaN(parsed.getTime())) {
      parts.push(parsed.toLocaleDateString())
    }
  }
  return parts.join(' • ')
}

export default function EmailChecklistButton({
  checklistId,
  recipientEmail,
  clientName,
  propertyAddress,
  visitDate,
  alreadySentAt
}: EmailChecklistButtonProps) {
  const router = useRouter()
  const [email, setEmail] = useState(recipientEmail ?? '')
  const [isSending, setIsSending] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  const contextLine = useMemo(() => formatContextLine(clientName, propertyAddress, visitDate), [clientName, propertyAddress, visitDate])

  async function handleSend() {
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setFeedback({ type: 'error', message: 'Add a recipient email before sending.' })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFeedback({ type: 'error', message: 'Enter a valid email address.' })
      return
    }

    try {
      setIsSending(true)
      setFeedback(null)

      const response = await fetch(`/api/checklists/${checklistId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = payload?.error ?? 'Failed to email the checklist. Please try again.'
        throw new Error(message)
      }

      setFeedback({ type: 'success', message: `Report emailed to ${trimmedEmail}.` })
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to email the checklist. Please try again.'
      setFeedback({ type: 'error', message })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 text-sm text-gray-700">
      {contextLine && <p className="text-xs text-gray-500">{contextLine}</p>}
      <label className="text-xs font-medium text-gray-700" htmlFor={`checklist-email-${checklistId}`}>
        Recipient email
      </label>
      <input
        id={`checklist-email-${checklistId}`}
        type="email"
        value={email}
        onChange={event => setEmail(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        placeholder="client@example.com"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={isSending || email.trim() === ''}
        className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
      >
        {isSending ? 'Sending…' : alreadySentAt ? 'Resend PDF report' : 'Send PDF report'}
      </button>
      {feedback && <p className={`text-xs ${feedback.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{feedback.message}</p>}
    </div>
  )
}
