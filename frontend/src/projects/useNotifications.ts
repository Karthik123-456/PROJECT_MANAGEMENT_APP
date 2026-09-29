import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/client.ts'
import type { Notification, PaginatedList } from '../api/types.ts'

export const unreadNotificationsKey = ['notifications', 'unread'] as const
export const notificationListKey = ['notifications', 'list'] as const

function markListItemRead(
  list: PaginatedList<Notification> | undefined,
  id: number,
  readAt: string,
): PaginatedList<Notification> | undefined {
  if (!list) return list
  return {
    ...list,
    data: list.data.map((item) =>
      item.id === id ? { ...item, read_at: item.read_at ?? readAt } : item,
    ),
  }
}

export function useUnreadNotifications() {
  return useQuery({
    queryKey: unreadNotificationsKey,
    queryFn: () => getNotifications({ unread: true }),
    refetchInterval: 15_000,
  })
}

export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: notificationListKey,
    queryFn: () => getNotifications({ limit: 20, offset: 0 }),
    enabled,
  })
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (id) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notificationListKey }),
        queryClient.cancelQueries({ queryKey: unreadNotificationsKey }),
      ])
      const previousList =
        queryClient.getQueryData<PaginatedList<Notification>>(notificationListKey)
      const previousUnread =
        queryClient.getQueryData<PaginatedList<Notification>>(unreadNotificationsKey)
      const readAt = new Date().toISOString()
      queryClient.setQueryData(
        notificationListKey,
        (list: PaginatedList<Notification> | undefined) =>
          markListItemRead(list, id, readAt),
      )
      queryClient.setQueryData(
        unreadNotificationsKey,
        (list: PaginatedList<Notification> | undefined) => {
          if (!list) return list
          return {
            ...list,
            data: list.data.filter((item) => item.id !== id),
            total: Math.max(0, list.total - 1),
          }
        },
      )
      return { previousList, previousUnread }
    },
    onError: (_error, _id, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(notificationListKey, context.previousList)
      }
      if (context?.previousUnread) {
        queryClient.setQueryData(unreadNotificationsKey, context.previousUnread)
      }
    },
    onSuccess: ({ notification }) => {
      queryClient.setQueryData(
        notificationListKey,
        (list: PaginatedList<Notification> | undefined) =>
          list
            ? {
                ...list,
                data: list.data.map((item) =>
                  item.id === notification.id ? notification : item,
                ),
              }
            : list,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: unreadNotificationsKey })
      void queryClient.invalidateQueries({ queryKey: notificationListKey })
    },
  })

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: notificationListKey }),
        queryClient.cancelQueries({ queryKey: unreadNotificationsKey }),
      ])
      const previousList =
        queryClient.getQueryData<PaginatedList<Notification>>(notificationListKey)
      const previousUnread =
        queryClient.getQueryData<PaginatedList<Notification>>(unreadNotificationsKey)
      const readAt = new Date().toISOString()
      queryClient.setQueryData(
        notificationListKey,
        (list: PaginatedList<Notification> | undefined) =>
          list
            ? {
                ...list,
                data: list.data.map((item) => ({
                  ...item,
                  read_at: item.read_at ?? readAt,
                })),
              }
            : list,
      )
      queryClient.setQueryData(
        unreadNotificationsKey,
        (list: PaginatedList<Notification> | undefined) =>
          list ? { ...list, data: [], total: 0 } : list,
      )
      return { previousList, previousUnread }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(notificationListKey, context.previousList)
      }
      if (context?.previousUnread) {
        queryClient.setQueryData(unreadNotificationsKey, context.previousUnread)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: unreadNotificationsKey })
      void queryClient.invalidateQueries({ queryKey: notificationListKey })
    },
  })

  return { markRead, markAllRead }
}
