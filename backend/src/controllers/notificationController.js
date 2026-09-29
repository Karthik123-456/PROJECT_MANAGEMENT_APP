import { paginationResult } from '../utils/pagination.js';

export function createNotificationController(service) {
  return {
    list(req, res) {
      const result = service.list(req.user.id, req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        result.limit,
        result.offset,
      ));
    },
    markRead(req, res) {
      const notification = service.markRead(
        req.validated.params.id,
        req.user.id,
      );
      res.status(200).json({ notification });
    },
    markAllRead(req, res) {
      const updated = service.markAllRead(req.user.id);
      res.status(200).json({ updated });
    },
  };
}
