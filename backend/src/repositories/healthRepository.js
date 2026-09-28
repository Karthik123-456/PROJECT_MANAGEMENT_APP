export function createHealthRepository(db) {
  const checkStatement = db.prepare('SELECT 1');

  return {
    check() {
      checkStatement.get();
    },
  };
}
