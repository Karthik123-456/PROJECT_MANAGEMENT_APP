import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../api/client.ts'
import type {
  PaginatedList,
  ProjectStatus,
  ProjectWithRole,
} from '../api/types.ts'

export const PROJECTS_PAGE_SIZE = 20

export interface ProjectsQuery {
  status: ProjectStatus
  limit: number
  offset: number
}

export function useProjects({
  status,
  limit,
  offset,
}: ProjectsQuery) {
  return useQuery({
    queryKey: ['projects', { status, limit, offset }],
    queryFn: () =>
      apiRequest<PaginatedList<ProjectWithRole>>(
        `/projects?status=${status}&limit=${limit}&offset=${offset}`,
      ),
  })
}
