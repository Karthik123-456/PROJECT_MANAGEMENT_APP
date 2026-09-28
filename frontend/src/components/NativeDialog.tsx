import { useEffect, useRef, type ReactNode } from 'react'

interface NativeDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  labelledBy?: string
}

export function NativeDialog({
  open,
  onClose,
  title,
  children,
  labelledBy,
}: NativeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const titleId = labelledBy ?? 'dialog-title'

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }

    return () => {
      if (dialog.open) dialog.close()
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus()
      }
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl rounded-md border border-line bg-surface p-0 text-ink shadow-2xl"
    >
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 id={titleId} className="text-lg font-bold">
          {title}
        </h2>
      </div>
      <div className="max-h-[calc(90vh-5rem)] overflow-y-auto px-5 py-5 sm:px-6">
        {children}
      </div>
    </dialog>
  )
}
