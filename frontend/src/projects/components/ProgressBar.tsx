import type { StoryProgress } from '../../api/types.ts'

interface ProgressBarProps {
  progress: StoryProgress
}

export function ProgressBar({ progress }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, progress.percent))
  const label =
    progress.total_tasks === 0
      ? 'No tasks'
      : `${progress.done_tasks} of ${progress.total_tasks} tasks complete`

  return (
    <div className="space-y-1" aria-label={`Progress: ${label}`}>
      <div className="flex items-center justify-between gap-3 text-xs text-secondary">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label="Story task completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-surface-hover"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
