import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../api/client.ts'
import type {
  Member,
  MemberInput,
  MemberRole,
  PaginatedList,
} from '../api/types.ts'

export function useMembers(projectId: number) {
  return useQuery({
    queryKey: ['project', projectId, 'members'],
    queryFn: () =>
      apiRequest<PaginatedList<Member>>(
        `/projects/${projectId}/members?limit=100&offset=0`,
      ),
    enabled: projectId > 0,
  })
}

export function useMemberMutations(projectId: number) {
  const queryClient = useQueryClient()
  const membersKey = ['project', projectId, 'members'] as const
  const treeKey = ['project', projectId, 'tree'] as const

  const addMember = useMutation({
    mutationFn: (input: MemberInput) =>
      apiRequest<{ member: Member }>(`/projects/${projectId}/members`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  })

  const changeMemberRole = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: MemberRole }) =>
      apiRequest<{ member: Member }>(
        `/projects/${projectId}/members/${userId}`,
        { method: 'PATCH', body: { role } },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: membersKey }),
  })

  const removeMember = useMutation({
    mutationFn: (userId: number) =>
      apiRequest<void>(`/projects/${projectId}/members/${userId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: membersKey })
      void queryClient.invalidateQueries({ queryKey: treeKey })
    },
  })

  return { addMember, changeMemberRole, removeMember }
}
