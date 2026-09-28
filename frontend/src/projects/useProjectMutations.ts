import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../api/client.ts'
import type {
  Project,
  ProjectInput,
  ProjectPatch,
} from '../api/types.ts'

export function useProjectMutations() {
  const queryClient = useQueryClient()

  const createProject = useMutation({
    mutationFn: (input: ProjectInput) =>
      apiRequest<{ project: Project }>('/projects', {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const archiveProject = useMutation({
    mutationFn: (id: number) =>
      apiRequest<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['project', id] })
      void queryClient.invalidateQueries({ queryKey: ['project', id, 'tree'] })
    },
  })

  const restoreProject = useMutation({
    mutationFn: (id: number) =>
      apiRequest<{ project: Project }>(`/projects/${id}/restore`, {
        method: 'POST',
      }),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['project', id] })
      void queryClient.invalidateQueries({ queryKey: ['project', id, 'tree'] })
    },
  })

  const updateProject = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: ProjectPatch }) =>
      apiRequest<{ project: Project }>(`/projects/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['project', id] })
      void queryClient.invalidateQueries({ queryKey: ['project', id, 'tree'] })
    },
  })

  return { createProject, archiveProject, restoreProject, updateProject }
}
