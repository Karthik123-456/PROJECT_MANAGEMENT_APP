import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const BCRYPT_COST = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('dummy-auth-password', BCRYPT_COST);

function createToken(userId) {
  return jwt.sign(
    { sub: userId },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: env.JWT_EXPIRES_IN,
    },
  );
}

function invalidCredentials() {
  return new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
}

export function createAuthService(userRepository) {
  return {
    async register({ email, name, password }) {
      if (userRepository.findPublicByEmail(email)) {
        throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      }

      const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
      let user;

      try {
        user = userRepository.createUser({ email, name, passwordHash });
      } catch (error) {
        if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
        }
        throw error;
      }

      return { user, token: createToken(user.id) };
    },

    async login({ email, password }) {
      const credentials = userRepository.findAuthByEmail(email);
      const passwordMatches = await bcrypt.compare(
        password,
        credentials?.password_hash ?? DUMMY_PASSWORD_HASH,
      );

      if (!credentials || !passwordMatches) {
        throw invalidCredentials();
      }

      const user = userRepository.findPublicById(credentials.id);
      if (!user) {
        throw invalidCredentials();
      }

      return { user, token: createToken(user.id) };
    },
  };
}
