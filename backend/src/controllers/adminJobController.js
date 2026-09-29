import { paginationResult } from '../utils/pagination.js';

export function createAdminJobController(service) {
  return {
    list(req, res) {
      const result = service.list(req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        result.limit,
        result.offset,
      ));
    },
    retry(req, res) {
      const job = service.retry(req.validated.params.id);
      res.status(200).json({ job });
    },
  };
}
