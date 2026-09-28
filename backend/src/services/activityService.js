export function createActivityService(activityRepository) {
  return {
    record(event) {
      activityRepository.insert(event);
    },
    list(projectId, { limit, offset }) {
      const { rows, total } = activityRepository.list(projectId, limit, offset);
      return { rows, total, limit, offset };
    },
  };
}
