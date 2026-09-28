import bcrypt from 'bcrypt';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';
import { createConnection } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { createUserRepository } from '../src/repositories/userRepository.js';
import { logger } from '../src/utils/logger.js';

const BCRYPT_COST = 12;
const seedUsers = [
  {
    email: 'admin@agile-tool.test',
    name: 'Admin',
    password: 'AdminDev123!',
    isAdmin: true,
  },
  {
    email: 'alice@agile-tool.test',
    name: 'Alice',
    password: 'DemoDev123!',
    isAdmin: false,
  },
  {
    email: 'bob@agile-tool.test',
    name: 'Bob',
    password: 'DemoDev123!',
    isAdmin: false,
  },
  {
    email: 'charlie@agile-tool.test',
    name: 'Charlie',
    password: 'DemoDev123!',
    isAdmin: false,
  },
];

async function runSeed() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed development accounts in production');
  }

  const db = createConnection();
  try {
    migrate(db);
    const userRepository = createUserRepository(db);
    const usersToSeed = await Promise.all(
      seedUsers.map(async ({ password, ...user }) => ({
        ...user,
        passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      })),
    );

    db.transaction(() => {
      for (const user of usersToSeed) {
        userRepository.createUserIfAbsent(user);
      }
    }).immediate();

    const credentials = seedUsers
      .map(({ email, password }) => `${email} / ${password}`)
      .join('\n');
    process.stdout.write(
      `Development seed credentials (existing users are not updated):\n${credentials}\n`,
    );
  } finally {
    db.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSeed().catch((error) => {
    logger.fatal({ err: error }, 'Seed failed');
    process.exitCode = 1;
  });
}