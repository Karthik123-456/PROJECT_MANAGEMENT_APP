import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequest } from '../api/client.ts'
import type {
  ProjectTree,
  TaskInput,
  TaskPatch,
  TaskResource,
  TaskStatus,
} from '../api/types.ts'

interface StatusMutationContext {
  previousTree: ProjectTree | undefined
}

function updateTaskStatus(
  tree: ProjectTree | undefined,
  taskId: number,
  status: TaskStatus,
): ProjectTree | undefined {
  if (!tree) return tree

  return {
    ...tree,
    stories: tree.stories.map((story) => {
      const tasks = story.tasks.map((task) =>
        task.id === taskId ? { ...task, status } : task,
      )
      if (tasks.every((task, index) => task === story.tasks[index])) {
        return story
      }
      const doneTasks = tasks.filter((task) => task.status === 'done').length
      const totalTasks = tasks.length
      return {
        ...story,
        tasks,
        progress: {
          done_tasks: doneTasks,
          total_tasks: totalTasks,
          percent:
            totalTasks === 0 ? 0 : Math.trunc((100 * doneTasks) / totalTasks),
        },
      }
    }),
  }
}

export function useTaskMutations(projectId: number) {
  const queryClient = useQueryClient()
  const treeKey = ['project', projectId, 'tree'] as const

  const createTask = useMutation({
    mutationFn: ({ storyId, input }: { storyId: number; input: TaskInput }) =>
      apiRequest<{ task: TaskResource }>(`/stories/${storyId}/tasks`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKey }),
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: TaskPatch }) =>
      apiRequest<{ task: TaskResource }>(`/tasks/${id}`, {
        method: 'PATCH',
        body: patch,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKey }),
  })

  const deleteTask = useMutation({
    mutationFn: (id: number) =>
      apiRequest<void>(`/tasks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: treeKey }),
  })

  const changeTaskStatus = useMutation<
    { task: TaskResource },
    Error,
    { id: number; status: TaskStatus },
    StatusMutationContext
  >({
    mutationFn: ({ id, status }) =>
      apiRequest<{ task: TaskResource }>(`/tasks/${id}`, {
        method: 'PATCH',
        body: { status },
      }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: treeKey })
      const previousTree = queryClient.getQueryData<ProjectTree>(treeKey)
      queryClient.setQueryData<ProjectTree>(treeKey, (tree) =>
        updateTaskStatus(tree, id, status),
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
    createTask,
    updateTask: updateTaskMutation,
    deleteTask,
    changeTaskStatus,
  }
}
