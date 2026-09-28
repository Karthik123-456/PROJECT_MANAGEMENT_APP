export function createDirectoryRepository(db) {
  const searchUsersStatement = db.prepare(`
    SELECT id, name, email
    FROM users
    WHERE name COLLATE NOCASE LIKE @pattern ESCAPE '\\'
       OR email COLLATE NOCASE LIKE @pattern ESCAPE '\\'
    ORDER BY name, id
    LIMIT 20
  `);
  const countUsersStatement = db.prepare(`
    SELECT COUNT(*) AS total
    FROM users
    WHERE name COLLATE NOCASE LIKE @pattern ESCAPE '\\'
       OR email COLLATE NOCASE LIKE @pattern ESCAPE '\\'
  `);

  return {
    searchUsers(search) {
      const escapedSearch = search.replace(/[\\%_]/g, '\\$&');
      const params = { pattern: `%${escapedSearch}%` };
      return {
        rows: searchUsersStatement.all(params),
        total: countUsersStatement.get(params).total,
      };
    },
  };
}
