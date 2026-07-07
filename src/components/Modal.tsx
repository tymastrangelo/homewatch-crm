'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { XIcon } from '@/components/icons'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/**
 * On phones this renders as a bottom sheet (slides up, rounded top corners,
 * safe-area padding); on larger screens it is a centered dialog.
 */
export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

  // Close modal on escape key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet-in flex max-h-[calc(100dvh-3rem)] w-full flex-col rounded-t-2xl border border-gray-200 bg-white shadow-xl sm:my-8 sm:max-w-2xl sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Grab handle, phones only */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-gray-900 sm:text-xl">{title}</h2>
          <button
            onClick={onClose}
            className="-mr-1.5 rounded-lg p-1.5 text-gray-400 hover:text-gray-800 active:bg-gray-100"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">{children}</div>
      </div>
    </div>
  )
}
