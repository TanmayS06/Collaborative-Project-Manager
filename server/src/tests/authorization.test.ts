import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'syncsphere_jwt_secret_dev_key';

const { userA, userB, workspaceAId, projectAId, taskAId, taskAData } = vi.hoisted(() => {
  const uA = {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'User A',
    email: 'usera@example.com',
  };

  const uB = {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    name: 'User B',
    email: 'userb@example.com',
  };

  const wAId = '11111111-1111-1111-1111-111111111111';
  const pAId = '22222222-2222-2222-2222-222222222222';
  const tAId = '33333333-3333-3333-3333-333333333333';

  const tAData = {
    id: tAId,
    projectId: pAId,
    title: 'Workspace A Sensitive Task',
    description: 'Confidential project details',
    status: 'TODO',
    priority: 'HIGH',
    orderIndex: 1000,
    assigneeId: uA.id,
    createdById: uA.id,
    dueDate: new Date('2026-12-01T00:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      id: pAId,
      workspaceId: wAId,
      name: 'Secret Project',
    },
    assignee: {
      id: uA.id,
      name: uA.name,
      email: uA.email,
      avatar: null,
    },
    createdBy: {
      id: uA.id,
      name: uA.name,
      email: uA.email,
      avatar: null,
    },
    comments: [],
    attachments: [],
    _count: { comments: 0 },
  };

  return {
    userA: uA,
    userB: uB,
    workspaceAId: wAId,
    projectAId: pAId,
    taskAId: tAId,
    taskAData: tAData,
  };
});

const tokenA = jwt.sign(userA, JWT_SECRET);
const tokenB = jwt.sign(userB, JWT_SECRET);

// Mock prisma for isolated, reproducible authorization testing
vi.mock('../config/prisma', () => {
  return {
    default: {
      workspaceMember: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          const { workspaceId, userId } = where.workspaceId_userId || {};
          // Only User A belongs to Workspace A
          if (workspaceId === '11111111-1111-1111-1111-111111111111' && userId === 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') {
            return Promise.resolve({
              id: 'wm-user-a',
              workspaceId,
              userId,
              role: 'OWNER',
              workspace: {
                id: workspaceId,
                name: 'Workspace Alpha',
                ownerId: userId,
              },
            });
          }
          // User B only belongs to Workspace B
          if (workspaceId === 'workspace-b-id' && userId === 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') {
            return Promise.resolve({
              id: 'wm-user-b',
              workspaceId,
              userId,
              role: 'MEMBER',
              workspace: {
                id: workspaceId,
                name: 'Workspace Beta',
                ownerId: 'other-owner',
              },
            });
          }
          return Promise.resolve(null);
        }),
      },
      project: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === '22222222-2222-2222-2222-222222222222') {
            return Promise.resolve({
              id: '22222222-2222-2222-2222-222222222222',
              workspaceId: '11111111-1111-1111-1111-111111111111',
              name: 'Secret Project',
            });
          }
          return Promise.resolve(null);
        }),
      },
      task: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === '33333333-3333-3333-3333-333333333333') {
            return Promise.resolve(taskAData);
          }
          return Promise.resolve(null);
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => {
          return Promise.resolve({
            id: 'new-task-uuid',
            ...data,
            assignee: taskAData.assignee,
            createdBy: taskAData.createdBy,
            _count: { comments: 0 },
          });
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          return Promise.resolve({
            ...taskAData,
            ...data,
          });
        }),
        delete: vi.fn().mockResolvedValue(taskAData),
        findMany: vi.fn().mockResolvedValue([]),
      },
      activity: {
        create: vi.fn().mockResolvedValue({
          id: 'act-1',
          action: 'STATUS_CHANGED',
          user: { id: userA.id, name: userA.name, email: userA.email, avatar: null },
        }),
      },
      taskComment: {
        create: vi.fn().mockResolvedValue({
          id: 'comment-1',
          content: 'Test comment',
          user: { id: userA.id, name: userA.name, email: userA.email, avatar: null },
        }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notif-1' }),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        const tx = {
          task: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: 'new-task-uuid',
              title: 'New Task',
              status: 'TODO',
              projectId: projectAId,
              assignee: taskAData.assignee,
              createdBy: taskAData.createdBy,
              _count: { comments: 0 },
            }),
            update: vi.fn().mockResolvedValue(taskAData),
            delete: vi.fn().mockResolvedValue(taskAData),
          },
          activity: {
            create: vi.fn().mockResolvedValue({
              id: 'act-1',
              action: 'STATUS_CHANGED',
              user: { id: userA.id, name: userA.name, email: userA.email, avatar: null },
            }),
          },
          taskComment: {
            create: vi.fn().mockResolvedValue({
              id: 'comment-1',
              content: 'Test comment',
              user: { id: userA.id, name: userA.name, email: userA.email, avatar: null },
            }),
          },
        };
        return await callback(tx);
      }),
    },
  };
});

// Mock Socket.IO emissions and BullMQ queues to avoid side effects during tests
vi.mock('../socket', () => ({
  emitToWorkspace: vi.fn(),
  emitToProject: vi.fn(),
  emitToUser: vi.fn(),
  initSocket: vi.fn(),
  getIO: vi.fn(),
}));

vi.mock('../jobs/reminderQueue', () => ({
  scheduleTaskReminder: vi.fn().mockResolvedValue(undefined),
  cancelTaskReminder: vi.fn().mockResolvedValue(true),
  getReminderQueue: vi.fn().mockReturnValue(null),
}));

import app from '../server';

describe('Gap 1: Cross-User & Cross-Workspace Authorization Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('REST Endpoint Authorization Verification', () => {
    it('GET /api/tasks/:id - allows workspace member to fetch task', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskAId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('task');
      expect(res.body.task.id).toBe(taskAId);
    });

    it('GET /api/tasks/:id - denies cross-workspace user access with 403 Forbidden', async () => {
      const res = await request(app)
        .get(`/api/tasks/${taskAId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied: You are not a member of this workspace');
    });

    it('PATCH /api/tasks/:id - denies cross-workspace user from modifying a task', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskAId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ status: 'DONE' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied: You are not a member of this workspace');
    });

    it('DELETE /api/tasks/:id - denies cross-workspace user from deleting a task', async () => {
      const res = await request(app)
        .delete(`/api/tasks/${taskAId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied: You are not a member of this workspace');
    });

    it('POST /api/tasks/:id/comments - denies cross-workspace user from adding comments', async () => {
      const res = await request(app)
        .post(`/api/tasks/${taskAId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Malicious external comment' });

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied: You are not a member of this workspace');
    });

    it('GET /api/tasks/search - denies cross-workspace search queries', async () => {
      const res = await request(app)
        .get(`/api/tasks/search?workspaceId=${workspaceAId}&q=Secret`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error', 'Access denied: You are not a member of this workspace');
    });
  });

  describe('Assignee Workspace Membership Validation', () => {
    it('POST /api/tasks - rejects creating a task assigned to a user outside the workspace', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          projectId: projectAId,
          title: 'Task with invalid external assignee',
          assigneeId: userB.id, // User B is not in Workspace A
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Assignee must be a member of this workspace');
    });

    it('PATCH /api/tasks/:id - rejects updating a task to assign a user outside the workspace', async () => {
      const res = await request(app)
        .patch(`/api/tasks/${taskAId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          assigneeId: userB.id, // User B is not in Workspace A
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'Assignee must be a member of this workspace');
    });

    it('POST /api/tasks - accepts creating a task assigned to a valid workspace member', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          projectId: projectAId,
          title: 'Task with valid member assignee',
          assigneeId: userA.id, // User A is in Workspace A
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('task');
    });
  });

  describe('Workspace Authorization Helpers & Role Verification', () => {
    it('verifyWorkspaceMembership returns membership for valid member', async () => {
      const { verifyWorkspaceMembership } = await import('../middleware/workspaceAuth');
      const membership = await verifyWorkspaceMembership(userA.id, workspaceAId);
      expect(membership).not.toBeNull();
      expect(membership?.role).toBe('OWNER');
    });

    it('verifyWorkspaceMembership returns null for non-member', async () => {
      const { verifyWorkspaceMembership } = await import('../middleware/workspaceAuth');
      const membership = await verifyWorkspaceMembership(userB.id, workspaceAId);
      expect(membership).toBeNull();
    });

    it('verifyWorkspaceMembership respects allowedRoles filtering', async () => {
      const { verifyWorkspaceMembership } = await import('../middleware/workspaceAuth');
      const isOwner = await verifyWorkspaceMembership(userA.id, workspaceAId, ['OWNER']);
      expect(isOwner).not.toBeNull();

      const isMemberOnly = await verifyWorkspaceMembership(userA.id, workspaceAId, ['MEMBER']);
      expect(isMemberOnly).toBeNull();
    });

    it('verifyProjectAccess grants access only to workspace members', async () => {
      const { verifyProjectAccess } = await import('../middleware/workspaceAuth');
      const resultA = await verifyProjectAccess(userA.id, projectAId);
      expect(resultA).not.toBeNull();

      const resultB = await verifyProjectAccess(userB.id, projectAId);
      expect(resultB).toBeNull();
    });

    it('verifyTaskAccess grants access only to workspace members', async () => {
      const { verifyTaskAccess } = await import('../middleware/workspaceAuth');
      const resultA = await verifyTaskAccess(userA.id, taskAId);
      expect(resultA).not.toBeNull();

      const resultB = await verifyTaskAccess(userB.id, taskAId);
      expect(resultB).toBeNull();
    });

    it('verifyAssigneeBelongsToWorkspace properly validates assignment', async () => {
      const { verifyAssigneeBelongsToWorkspace } = await import('../middleware/workspaceAuth');
      const valid = await verifyAssigneeBelongsToWorkspace(workspaceAId, userA.id);
      expect(valid).toBe(true);

      const invalid = await verifyAssigneeBelongsToWorkspace(workspaceAId, userB.id);
      expect(invalid).toBe(false);

      const unassigned = await verifyAssigneeBelongsToWorkspace(workspaceAId, null);
      expect(unassigned).toBe(true);
    });
  });
});

