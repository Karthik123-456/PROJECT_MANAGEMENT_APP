import { paginationResult } from '../utils/pagination.js';

export function createStoryTaskController(service) {
  return {
    listStories(req, res) {
      const result = service.listStories(req.access.project.id, req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        req.validated.query.limit,
        req.validated.query.offset,
      ));
    },
    createStory(req, res) {
      const story = service.createStory({
        projectId: req.access.project.id,
        actorId: req.user.id,
        body: req.validated.body,
      });
      res.status(201).json({ story });
    },
    getStory(req, res) {
      res.status(200).json({ story: service.getStory(req.validated.params.id) });
    },
    updateStory(req, res) {
      const story = service.updateStory({
        projectId: req.access.project.id,
        actorId: req.user.id,
        storyId: req.validated.params.id,
        body: req.validated.body,
      });
      res.status(200).json({ story });
    },
    deleteStory(req, res) {
      service.deleteStory({
        projectId: req.access.project.id,
        actorId: req.user.id,
        storyId: req.validated.params.id,
      });
      res.status(204).end();
    },
    listTasks(req, res) {
      const result = service.listTasks(req.validated.params.id, req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        req.validated.query.limit,
        req.validated.query.offset,
      ));
    },
    createTask(req, res) {
      const task = service.createTask({
        projectId: req.access.project.id,
        actorId: req.user.id,
        storyId: req.validated.params.id,
        body: req.validated.body,
      });
      res.status(201).json({ task });
    },
    getTask(req, res) {
      res.status(200).json({ task: service.getTask(req.validated.params.id) });
    },
    updateTask(req, res) {
      const task = service.updateTask({
        projectId: req.access.project.id,
        actorId: req.user.id,
        taskId: req.validated.params.id,
        body: req.validated.body,
      });
      res.status(200).json({ task });
    },
    deleteTask(req, res) {
      service.deleteTask({
        projectId: req.access.project.id,
        actorId: req.user.id,
        taskId: req.validated.params.id,
      });
      res.status(204).end();
    },
    myTasks(req, res) {
      const result = service.listMyTasks(req.user.id, req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        result.limit,
        result.offset,
      ));
    },
    tree(req, res) {
      res.status(200).json(
        service.getTree(req.access.project, req.access.project.id),
      );
    },
  };
}
