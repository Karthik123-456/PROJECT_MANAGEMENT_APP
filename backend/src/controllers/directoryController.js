import { paginationResult } from '../utils/pagination.js';

export function createDirectoryController(directoryService) {
  return {
    searchUsers(req, res) {
      const result = directoryService.searchUsers(req.validated.query.search);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        result.limit,
        result.offset,
      ));
    },
  };
}
