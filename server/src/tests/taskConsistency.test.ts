import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'syncsphere_jwt_secret_dev_key';

const {
  testUser,
  testWorkspaceId,
  testProjectId,
  testTaskId,
  initialTask,
  stateHolder,
  mockCancelTaskReminder,
  mockScheduleTaskReminder,
  mockEmitToWorkspace,
  mockDeleteCache,
} = vi.hoisted(() => {
  const user = {
    id: '11111111-2222-3333-4444-555555555555',
    name: 'Consistency Tester',
    email: 'tester@example.com',
  };

  const wId = 'w1111111-1111-1111-1111-111111111111';
  const pId = 'p2222222-2222-2222-2222-222222222222';
  const tId = 't3333333-3333-3333-3333-333333333333';

  const tData = {
    id: tId,
    projectId: pId,
    title: 'Consistent Task Flow',
    description: 'Testing background queue and db transactions',
    status: 'TODO',
    priority: 'MEDIUM',
    orderIndex: 1000,
    assigneeId: user.id,
    createdById: user.id,
    dueDate: new Date('2026-11-20T10:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      id: pId,
      workspaceId: wId,
      name: 'Consistency Project',
    },
    assignee: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: null,
    },
    createdBy: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: null,
    },
    comments: [],
    attachments: [],
    _count: { comments: 0 },
  };

  return {
    testUser: user,
    testWorkspaceId: wId,
    testProjectId: pId,
    testTaskId: tId,
    initialTask: tData,
    stateHolder: { current: { ...tData } },
    mockCancelTaskReminder: vi.fn().mockResolvedValue(true),
    mockScheduleTaskReminder: vi.fn().mockResolvedValue(undefined),
    mockEmitToWorkspace: vi.fn(),
    mockDeleteCache: vi.fn().mockResolvedValue(undefined),
  };
});

const userToken = jwt.sign(testUser, JWT_SECRET);

// Mock BullMQ reminder queue
vi.mock('../jobs/reminderQueue', () => ({
  scheduleTaskReminder: mockScheduleTaskReminder,
  cancelTaskReminder: mockCancelTaskReminder,
  getReminderQueue: vi.fn().mockReturnValue(null),
}));

// Mock Socket.IO broadcasts
vi.mock('../socket', () => ({
  emitToWorkspace: mockEmitToWorkspace,
  emitToProject: vi.fn(),
  emitToUser: vi.fn(),
  initSocket: vi.fn(),
  getIO: vi.fn(),
}));

// Mock Cache service
vi.mock('../services/cacheService', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCache: mockDeleteCache,
  invalidateCachePattern: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/prisma', () => {
  return {
    default: {
      workspaceMember: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const { workspaceId, userId } = where.workspaceId_userId || {};
          if (workspaceId === testWorkspaceId && userId === testUser.id) {
            return Promise.resolve({
              id: 'wm-tester',
              workspaceId,
              userId,
              role: 'OWNER',
            });
          }
          return Promise.resolve(null);
        }),
      },
      project: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === testProjectId) {
            return Promise.resolve({
              id: testProjectId,
              workspaceId: testWorkspaceId,
              name: 'Consistency Project',
            });
          }
          return Promise.resolve(null);
        }),
      },
      task: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === testTaskId) {
            return Promise.resolve(stateHolder.current);
          }
          return Promise.resolve(null);
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        delete: vi.fn().mockImplementation(() => Promise.resolve(stateHolder.current)),
      },
      activity: {
        create: vi.fn().mockResolvedValue({ id: 'act-123' }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(({ data }) => {
              stateHolder.current = {
                ...initialTask,
                ...data,
                id: 'new-trans-task',
              };
              return Promise.resolve(stateHolder.current);
            }),
            update: vi.fn().mockImplementation(({ data }) => {
              stateHolder.current = {
                ...stateHolder.current,
                ...data,
                updatedAt: new Date(),
              };
              return Promise.resolve(stateHolder.current);
            }),
            delete: vi.fn().mockImplementation(() => {
              const deleted = { ...stateHolder.current };
              return Promise.resolve(deleted);
            }),
          },
          activity: {
            create: vi.fn().mockResolvedValue({
              id: 'act-trans-1',
              action: 'STATUS_CHANGED',
              user: { id: testUser.id, name: testUser.name, email: testUser.email, avatar: null },
            }),
          },
          taskComment: {
            create: vi.fn().mockResolvedValue({
              id: 'comm-1',
              content: 'Transactional comment',
              user: { id: testUser.id, name: testUser.name, email: testUser.email, avatar: null },
            }),
          },
        };
        return await callback(tx);
      }),
    },
  };
});

import app from '../server';

describe('Gap 2: Task Updates, Reminders & Transactional Consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateHolder.current = { ...initialTask };
  });

  describe('Reminder Queue Lifecycle Management', () => {
    it('cancels obsolete reminder and reschedules when task due date changes', async () => {
      const newDueDate = '2026-12-25T15:00:00.000Z';

      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ dueDate: newDueDate });

      expect(res.status).toBe(200);

      // Obsolete reminder was cancelled
      expect(mockCancelTaskReminder).toHaveBeenCalledWith(testTaskId);

      // New reminder was scheduled with updated due date
      expect(mockScheduleTaskReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: testTaskId,
          dueDate: new Date(newDueDate).toISOString(),
          assigneeId: testUser.id,
        })
      );
    });

    it('cancels reminder and does NOT reschedule when task is completed (DONE)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'DONE' });

      expect(res.status).toBe(200);

      // Obsolete reminder was cancelled
      expect(mockCancelTaskReminder).toHaveBeenCalledWith(testTaskId);

      // No new reminder was scheduled for a completed task
      expect(mockScheduleTaskReminder).not.toHaveBeenCalled();
    });

    it('cancels reminder when task is unassigned (assigneeId: null)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ assigneeId: null });

      expect(res.status).toBe(200);

      // Reminder must be cancelled since there is no assignee to notify
      expect(mockCancelTaskReminder).toHaveBeenCalledWith(testTaskId);
      expect(mockScheduleTaskReminder).not.toHaveBeenCalled();
    });

    it('cancels reminder when task due date is removed (dueDate: null)', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ dueDate: null });

      expect(res.status).toBe(200);

      // Reminder must be cancelled since there is no deadline
      expect(mockCancelTaskReminder).toHaveBeenCalledWith(testTaskId);
      expect(mockScheduleTaskReminder).not.toHaveBeenCalled();
    });

    it('cancels queued reminder job when a task is deleted', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message', 'Task deleted successfully');

      // Crucial: BullMQ reminder job must be cancelled on deletion
      expect(mockCancelTaskReminder).toHaveBeenCalledWith(testTaskId);
    });
  });

  describe('Transactional Execution & Side Effect Ordering', () => {
    it('executes task mutations and activity logging atomically within $transaction', async () => {
      const prisma = (await import('../config/prisma')).default;

      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);

      // Verify that prisma.$transaction was utilized
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('emits real-time broadcasts and invalidates Redis cache post-commit', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${testTaskId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'IN_REVIEW' });

      expect(res.status).toBe(200);

      // Socket broadcast happened for updated task
      expect(mockEmitToWorkspace).toHaveBeenCalledWith(
        testWorkspaceId,
        'task:updated',
        expect.objectContaining({ id: testTaskId, status: 'IN_REVIEW' })
      );

      // Activity logged was broadcasted
      expect(mockEmitToWorkspace).toHaveBeenCalledWith(
        testWorkspaceId,
        'activity:logged',
        expect.anything()
      );

      // Project cache was invalidated
      expect(mockDeleteCache).toHaveBeenCalledWith(`cache:project:${testProjectId}`);
    });
  });
});
