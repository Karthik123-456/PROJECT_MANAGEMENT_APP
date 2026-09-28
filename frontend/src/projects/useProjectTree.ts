import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../api/client.ts'
import type { ProjectDetail, ProjectTree } from '../api/types.ts'

export function useProject(id: number) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => apiRequest<ProjectDetail>(`/projects/${id}`),
    enabled: id > 0,
  })
}

export function useProjectTree(id: number) {
  return useQuery({
    queryKey: ['project', id, 'tree'],
    queryFn: () => apiRequest<ProjectTree>(`/projects/${id}/tree`),
    enabled: id > 0,
  })
}
