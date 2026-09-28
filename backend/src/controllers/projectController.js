import { paginationResult } from '../utils/pagination.js';

export function createProjectController(projectService, memberService, activityService) {
  return {
    list(req, res) {
      const result = projectService.list(req.user.id, req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        result.limit,
        result.offset,
      ));
    },
    create(req, res) {
      const project = projectService.create({ user: req.user, ...req.validated.body });
      res.status(201).json({ project });
    },
    get(req, res) {
      res.status(200).json({
        project: { ...req.access.project, role: req.access.role },
      });
    },
    update(req, res) {
      const project = projectService.update({
        project: req.access.project,
        user: req.user,
        patch: req.validated.body,
      });
      res.status(200).json({ project });
    },
    archive(req, res) {
      projectService.archive({ project: req.access.project, user: req.user });
      res.status(204).end();
    },
    restore(req, res) {
      const project = projectService.restore({ project: req.access.project, user: req.user });
      res.status(200).json({ project });
    },
    listMembers(req, res) {
      const result = memberService.list(req.access.project.id, req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        result.limit,
        result.offset,
      ));
    },
    addMember(req, res) {
      const member = memberService.add({
        projectId: req.access.project.id,
        actorId: req.user.id,
        ...req.validated.body,
      });
      res.status(201).json({ member });
    },
    changeMemberRole(req, res) {
      const member = memberService.changeRole({
        projectId: req.access.project.id,
        actorId: req.user.id,
        userId: req.validated.params.userId,
        ...req.validated.body,
      });
      res.status(200).json({ member });
    },
    removeMember(req, res) {
      memberService.remove({
        projectId: req.access.project.id,
        actorId: req.user.id,
        userId: req.validated.params.userId,
      });
      res.status(204).end();
    },
    activity(req, res) {
      const result = activityService.list(req.access.project.id, req.validated.query);
      res.status(200).json(paginationResult(
        result.rows,
        result.total,
        result.limit,
        result.offset,
      ));
    },
  };
}
