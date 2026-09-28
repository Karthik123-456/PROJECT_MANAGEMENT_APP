export function createDirectoryService(directoryRepository) {
  return {
    searchUsers(search) {
      const { rows, total } = directoryRepository.searchUsers(search);
      return { rows, total, limit: 20, offset: 0 };
    },
  };
}
