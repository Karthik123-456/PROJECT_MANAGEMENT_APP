import { AppError } from '../utils/AppError.js';

export function createAdminJobService(repository) {
  return {
    list(query) {
      const result = repository.list(query);
      return { ...result, limit: query.limit, offset: query.offset };
    },
    retry(id) {
      const current = repository.find(id);
      if (!current) {
        throw new AppError(404, 'NOT_FOUND', 'Resource not found');
      }
      if (current.status !== 'dead') {
        throw new AppError(409, 'JOB_NOT_DEAD', 'Only dead jobs can be retried');
      }
      if (!repository.retry(id)) {
        const latest = repository.find(id);
        if (!latest) {
          throw new AppError(404, 'NOT_FOUND', 'Resource not found');
        }
        throw new AppError(409, 'JOB_NOT_DEAD', 'Only dead jobs can be retried');
      }
      return repository.find(id);
    },
  };
}
