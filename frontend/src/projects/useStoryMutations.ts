import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../api/client.ts'
import type {
  ProjectTree,
  Story,
  StoryInput,
  StoryPatch,
  StoryStatus,
} from '../api/types.ts'

interface StatusMutationContext {
  previousTree: ProjectTree | undefined
}

function updateStory(
  tree: ProjectTree | undefined,
  storyId: number,
  update: (story: ProjectTree['stories'][number]) => ProjectTree['stories'][number],
): ProjectTree | undefined {
  if (!tree) return tree
  return {
    ...tree,
    stories: tree.stories.map((story) =>
      story.id === storyId ? update(story) : story,
    ),
  }
}

export function useStoryMutations(projectId: number) {
  const queryClient = useQueryClient()
  const treeKey = ['project', projectId, 'tree'] as const

  const createStory = useMutation({
    mutationFn: (input: StoryInput) =>
      apiRequest<{ story: Story }>(`/projects/${projectId}/stories`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKey }),
  })

  const updateStoryMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: StoryPatch }) =>
      apiRequest<{ story: Story }>(`/stories/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKey }),
  })

  const deleteStory = useMutation({
    mutationFn: (id: number) =>
      apiRequest<void>(`/stories/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKey }),
  })

  const changeStoryStatus = useMutation<
    { story: Story },
    Error,
    { id: number; status: StoryStatus },
    StatusMutationContext
  >({
    mutationFn: ({ id, status }) =>
      apiRequest<{ story: Story }>(`/stories/${id}`, {
        method: 'PATCH',
        body: { status },
      }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: treeKey })
      const previousTree = queryClient.getQueryData<ProjectTree>(treeKey)
      queryClient.setQueryData<ProjectTree>(treeKey, (tree) =>
        updateStory(tree, id, (story) => ({ ...story, status })),
      )
      return { previousTree }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTree) {
        queryClient.setQueryData(treeKey, context.previousTree)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: treeKey }),
  })

  return {
    createStory,
    updateStory: updateStoryMutation,
    deleteStory,
    changeStoryStatus,
  }
}
