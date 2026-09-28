import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar.tsx'

describe('ProgressBar', () => {
  it('renders the backend progress percentage and task count', () => {
    render(
      <ProgressBar
        progress={{ done_tasks: 2, total_tasks: 3, percent: 66 }}
      />,
    )

    expect(screen.getByText('66%')).toBeInTheDocument()
    expect(screen.getByText('2 of 3 tasks complete')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '66',
    )
  })

  it('describes the zero-task state without implying completion', () => {
    render(
      <ProgressBar
        progress={{ done_tasks: 0, total_tasks: 0, percent: 0 }}
      />,
    )

    expect(screen.getByText('No tasks')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})
