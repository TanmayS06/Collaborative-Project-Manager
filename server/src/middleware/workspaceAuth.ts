import { Response, NextFunction } from 'express';
import { WorkspaceRole } from '@prisma/client';
import prisma from '../config/prisma';
import { AuthRequest } from './auth';

/**
 * Check if a user belongs to a workspace with optional role checking
 */
export const verifyWorkspaceMembership = async (
  userId: string,
  workspaceId: string,
  allowedRoles?: WorkspaceRole[]
) => {
  if (!userId || !workspaceId) return null;

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    include: {
      workspace: {
        select: { id: true, name: true, ownerId: true },
      },
    },
  });

  if (!membership) return null;

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(membership.role)) {
      return null;
    }
  }

  return membership;
};

/**
 * Check if a user has access to a project through workspace membership
 */
export const verifyProjectAccess = async (
  userId: string,
  projectId: string,
  allowedRoles?: WorkspaceRole[]
) => {
  if (!userId || !projectId) return null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: {
        select: { id: true, name: true, ownerId: true },
      },
    },
  });

  if (!project) return null;

  const membership = await verifyWorkspaceMembership(userId, project.workspaceId, allowedRoles);
  if (!membership) return null;

  return { project, membership };
};

/**
 * Check if a user has access to a task through workspace membership
 */
export const verifyTaskAccess = async (
  userId: string,
  taskId: string,
  allowedRoles?: WorkspaceRole[]
) => {
  if (!userId || !taskId) return null;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          workspace: {
            select: { id: true, name: true, ownerId: true },
          },
        },
      },
    },
  });

  if (!task) return null;

  const membership = await verifyWorkspaceMembership(userId, task.project.workspaceId, allowedRoles);
  if (!membership) return null;

  return { task, membership };
};

/**
 * Verify that a designated assignee belongs to the target workspace
 */
export const verifyAssigneeBelongsToWorkspace = async (
  workspaceId: string,
  assigneeId?: string | null
): Promise<boolean> => {
  if (!assigneeId) return true; // Unassigned is valid

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: assigneeId,
      },
    },
  });

  return !!membership;
};

/**
 * Express middleware to require workspace membership
 */
export const requireWorkspaceMember = (
  workspaceIdParam: string = 'id',
  allowedRoles?: WorkspaceRole[]
) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    const workspaceId = req.params[workspaceIdParam] || req.body[workspaceIdParam] || (req.query[workspaceIdParam] as string);

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!workspaceId) {
      res.status(400).json({ error: 'Workspace ID is required' });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId, allowedRoles);
    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not an authorized member of this workspace' });
      return;
    }

    req.workspaceMembership = {
      workspaceId: membership.workspaceId,
      role: membership.role,
    };

    next();
  };
};
