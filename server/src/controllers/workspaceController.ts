import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { recordActivity } from '../services/activityService';

const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  description: z.string().optional(),
});

const addMemberSchema = z.object({
  email: z.string().email('Valid email is required'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']).default('MEMBER'),
});

export const createWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validated = createWorkspaceSchema.parse(req.body);
    const userId = req.user!.id;

    const workspace = await prisma.workspace.create({
      data: {
        name: validated.name.trim(),
        description: validated.description?.trim(),
        ownerId: userId,
        members: {
          create: {
            userId: userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    await recordActivity({
      workspaceId: workspace.id,
      userId,
      entityType: 'WORKSPACE',
      entityId: workspace.id,
      action: 'CREATED',
      metadata: { name: workspace.name },
    });

    res.status(201).json({ workspace });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
};

export const getWorkspaces = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        _count: {
          select: { projects: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ workspaces });
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
};

export const getWorkspaceById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: id,
          userId,
        },
      },
    });

    if (!membership) {
      res.status(403).json({ error: 'You are not a member of this workspace' });
      return;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
        projects: {
          include: {
            _count: {
              select: { tasks: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        activities: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return;
    }

    res.json({ workspace, currentUserRole: membership.role });
  } catch (error) {
    console.error('Get workspace details error:', error);
    res.status(500).json({ error: 'Failed to retrieve workspace details' });
  }
};

export const addWorkspaceMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: workspaceId } = req.params;
    const currentUserId = req.user!.id;
    const validated = addMemberSchema.parse(req.body);

    // Verify current user permissions (OWNER or ADMIN)
    const currentMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: currentUserId,
        },
      },
    });

    if (!currentMembership || (currentMembership.role !== 'OWNER' && currentMembership.role !== 'ADMIN')) {
      res.status(403).json({ error: 'Only workspace owners or admins can invite new members' });
      return;
    }

    // Find the invited user by email
    const targetUser = await prisma.user.findUnique({
      where: { email: validated.email.toLowerCase().trim() },
    });

    if (!targetUser) {
      res.status(404).json({
        error: `No registered user found with email "${validated.email}". In Phase 1, the user must first register an account.`,
      });
      return;
    }

    // Check if already a member
    const existingMembership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMembership) {
      res.status(409).json({ error: 'This user is already a member of this workspace' });
      return;
    }

    const newMember = await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: validated.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    await recordActivity({
      workspaceId,
      userId: currentUserId,
      entityType: 'MEMBER',
      entityId: targetUser.id,
      action: 'JOINED',
      metadata: { memberName: targetUser.name, role: validated.role },
    });

    res.status(201).json({ member: newMember, message: `${targetUser.name} added to workspace successfully` });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Failed to add workspace member' });
  }
};
