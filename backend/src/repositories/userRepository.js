function toPublicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    is_admin: Boolean(row.is_admin),
    created_at: row.created_at,
  };
}

export function createUserRepository(db) {
  const findAuthByEmailStatement = db.prepare(`
    SELECT id, email, name, password_hash, is_admin, created_at
    FROM users
    WHERE email = ?
  `);
  const findPublicByEmailStatement = db.prepare(`
    SELECT id, email, name, is_admin, created_at
    FROM users
    WHERE email = ?
  `);
  const findPublicByIdStatement = db.prepare(`
    SELECT id, email, name, is_admin, created_at
    FROM users
    WHERE id = ?
  `);
  const insertUserStatement = db.prepare(`
    INSERT INTO users (email, name, password_hash, is_admin)
    VALUES (@email, @name, @passwordHash, @isAdmin)
  `);
  const insertUserIfAbsentStatement = db.prepare(`
    INSERT INTO users (email, name, password_hash, is_admin)
    VALUES (@email, @name, @passwordHash, @isAdmin)
    ON CONFLICT(email) DO NOTHING
  `);

  return {
    findAuthByEmail(email) {
      return findAuthByEmailStatement.get(email) ?? null;
    },

    findPublicByEmail(email) {
      return toPublicUser(findPublicByEmailStatement.get(email));
    },

    findPublicById(id) {
      return toPublicUser(findPublicByIdStatement.get(id));
    },

    createUser({ email, name, passwordHash, isAdmin = false }) {
      const result = insertUserStatement.run({
        email,
        name,
        passwordHash,
        isAdmin: Number(isAdmin),
      });
      return this.findPublicById(Number(result.lastInsertRowid));
    },

    createUserIfAbsent({ email, name, passwordHash, isAdmin = false }) {
      const result = insertUserIfAbsentStatement.run({
        email,
        name,
        passwordHash,
        isAdmin: Number(isAdmin),
      });
      return {
        user: this.findPublicByEmail(email),
        created: result.changes === 1,
      };
    },
  };
}
