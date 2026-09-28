import { ApiError } from '../api/client.ts'

export function projectErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.'
  }

  if (error.status === 409) {
    switch (error.code) {
      case 'STORY_HAS_OPEN_TASKS':
        return 'Finish all tasks before completing this story.'
      case 'STORY_DONE':
        return 'Reopen the story to add tasks.'
      case 'PROJECT_ARCHIVED':
        return 'This project is archived and cannot be changed.'
    }
  }
  if (error.status === 403 && error.code === 'FORBIDDEN') {
    return "You don't have permission to do that."
  }
  if (
    error.status === 422 &&
    error.details?.some((detail) => {
      const path =
        typeof detail.path === 'string' ? detail.path : detail.path.join('.')
      return path === 'assignee_id'
    })
  ) {
    return 'Choose a project member as the assignee.'
  }

  return error.message
}
