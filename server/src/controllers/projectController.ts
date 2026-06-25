import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { recordActivity } from '../services/activityService';
import { getCache, setCache } from '../services/cacheService';

const createProjectSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
});

export const createProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validated = createProjectSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: validated.workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this workspace' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        workspaceId: validated.workspaceId,
        name: validated.name.trim(),
        description: validated.description?.trim(),
      },
    });

    await recordActivity({
      workspaceId: validated.workspaceId,
      userId,
      entityType: 'PROJECT',
      entityId: project.id,
      action: 'CREATED',
      metadata: { name: project.name },
    });

    res.status(201).json({ project });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

export const getProjectById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const cacheKey = `cache:project:${id}`;
    const cached = await getCache<any>(cacheKey);

    if (cached) {
      const isMember = cached.workspace?.members?.some((m: any) => m.userId === userId);
      if (!isMember) {
        res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
        return;
      }
      res.setHeader('X-Cache', 'HIT');
      res.json({ project: cached });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, avatar: true },
                },
              },
            },
          },
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true, avatar: true },
            },
            createdBy: {
              select: { id: true, name: true, email: true, avatar: true },
            },
            _count: {
              select: { comments: true },
            },
          },
          orderBy: [
            { orderIndex: 'asc' },
            { createdAt: 'desc' },
          ],
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Verify user is in the project's workspace
    const isMember = project.workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    // Cache project data for 2 minutes (invalidated immediately when tasks/comments change)
    await setCache(cacheKey, project, 120);

    res.setHeader('X-Cache', 'MISS');
    res.json({ project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};
