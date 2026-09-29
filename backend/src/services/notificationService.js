import { AppError } from '../utils/AppError.js';

export function createNotificationService(repository) {
  function requireOwnedNotification(id, userId) {
    const notification = repository.findOwned(id, userId);
    if (!notification) {
      throw new AppError(404, 'NOT_FOUND', 'Resource not found');
    }
    return notification;
  }

  return {
    list(userId, { unread, limit, offset }) {
      const result = repository.listForUser({
        userId,
        unread: unread === 'true',
        limit,
        offset,
      });
      return { ...result, limit, offset };
    },
    markRead(id, userId) {
      requireOwnedNotification(id, userId);
      repository.markRead(id, userId);
      return requireOwnedNotification(id, userId);
    },
    markAllRead(userId) {
      return repository.markAllRead(userId);
    },
  };
}
