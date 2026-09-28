import { NativeDialog } from '../../components/NativeDialog.tsx'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  pending?: boolean
  onClose: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pending = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      title={title}
      labelledBy={`confirm-${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`}
    >
      <div className="space-y-5">
        <p className="text-sm text-secondary">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-line px-4 py-2 text-sm font-semibold text-secondary transition hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {pending ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </NativeDialog>
  )
}
