'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteChecklist } from '@/app/actions/checklists'

export default function DeleteChecklistButton({ checklistId }: { checklistId: string }) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete() {
    if (!window.confirm('Delete this checklist permanently? This cannot be undone.')) return
    setIsDeleting(true)
    const result = await deleteChecklist(checklistId)
    if (result.ok) {
      router.push('/checklists')
      router.refresh()
    } else {
      window.alert(result.error)
      setIsDeleting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-60"
    >
      {isDeleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
