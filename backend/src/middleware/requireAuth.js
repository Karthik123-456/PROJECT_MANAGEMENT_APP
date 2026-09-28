import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function unauthenticated() {
  return new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
}

export function requireAuth(userRepository) {
  return (req, res, next) => {
    const authorization = req.get('authorization') ?? '';
    const match = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!match) {
      return next(unauthenticated());
    }

    let claims;
    try {
      claims = jwt.verify(match[1], env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return next(unauthenticated());
    }

    if (!claims || typeof claims !== 'object' || !Number.isInteger(claims.sub)) {
      return next(unauthenticated());
    }

    const user = userRepository.findPublicById(claims.sub);
    if (!user) {
      return next(unauthenticated());
    }

    req.user = user;
    next();
  };
}
