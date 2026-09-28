import { AppError } from '../utils/AppError.js';

function missingMember() {
  return new AppError(404, 'NOT_FOUND', 'Resource not found');
}

function ownerCannotChange() {
  return new AppError(409, 'OWNER_CANNOT_BE_CHANGED', 'The project owner cannot be changed');
}

export function createMemberService(db, memberRepository, activityService) {
  return {
    list(projectId, { limit, offset }) {
      const { rows, total } = memberRepository.list(projectId, limit, offset);
      return { rows, total, limit, offset };
    },

    add({ projectId, actorId, email, role }) {
      let member;
      db.transaction(() => {
        const user = memberRepository.findUserByEmail(email);
        if (!user) {
          throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
        }
        if (memberRepository.findById(projectId, user.id)) {
          throw new AppError(409, 'ALREADY_MEMBER', 'User is already a project member');
        }

        member = memberRepository.add({ projectId, userId: user.id, role });
        activityService.record({
          projectId,
          actorId,
          entityType: 'member',
          entityId: member.id,
          action: 'member.added',
          meta: { role },
        });
      }).immediate();
      return member;
    },

    changeRole({ projectId, actorId, userId, role }) {
      let member;
      db.transaction(() => {
        const current = memberRepository.findById(projectId, userId);
        if (!current) throw missingMember();
        if (current.role === 'owner') throw ownerCannotChange();

        member = memberRepository.setRole({ projectId, userId, role });
        activityService.record({
          projectId,
          actorId,
          entityType: 'member',
          entityId: userId,
          action: 'member.role_changed',
          meta: { old_role: current.role, new_role: role },
        });
      }).immediate();
      return member;
    },

    remove({ projectId, actorId, userId }) {
      db.transaction(() => {
        const current = memberRepository.findById(projectId, userId);
        if (!current) throw missingMember();
        if (current.role === 'owner') throw ownerCannotChange();

        memberRepository.remove(projectId, userId);
        activityService.record({
          projectId,
          actorId,
          entityType: 'member',
          entityId: userId,
          action: 'member.removed',
          meta: { role: current.role },
        });
      }).immediate();
    },
  };
}
