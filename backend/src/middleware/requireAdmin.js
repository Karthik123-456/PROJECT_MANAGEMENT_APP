import { AppError } from '../utils/AppError.js';

export function requireAdmin(req, res, next) {
  if (req.user?.is_admin !== true) {
    return next(new AppError(403, 'FORBIDDEN', 'Administrator access required'));
  }
  next();
}
