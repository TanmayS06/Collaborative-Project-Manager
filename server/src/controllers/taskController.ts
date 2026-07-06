import { Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  verifyWorkspaceMembership,
  verifyAssigneeBelongsToWorkspace,
} from '../middleware/workspaceAuth';
import { emitToWorkspace, emitToUser } from '../socket';
import { deleteCache } from '../services/cacheService';
import { scheduleTaskReminder, cancelTaskReminder } from '../jobs/reminderQueue';

const createNotification = async (userId: string, data: { type: string; title: string; message: string; link?: string }) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link,
      },
    });
    emitToUser(userId, 'notification:received', notification);
    return notification;
  } catch (err) {
    console.error('Failed to dispatch notification:', err);
  }
};

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  orderIndex: z.number().optional(),
});

const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
});

export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const validated = createTaskSchema.parse(req.body);
    const userId = req.user!.id;

    // Verify project existence
    const project = await prisma.project.findUnique({
      where: { id: validated.projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Verify requesting user is a workspace member
    const membership = await verifyWorkspaceMembership(userId, project.workspaceId);
    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    // Verify that assignee belongs to the target workspace if specified
    if (validated.assigneeId) {
      const isAssigneeMember = await verifyAssigneeBelongsToWorkspace(project.workspaceId, validated.assigneeId);
      if (!isAssigneeMember) {
        res.status(400).json({ error: 'Assignee must be a member of this workspace' });
        return;
      }
    }

    // Atomic transaction: task creation + activity record logging
    const { task, activity } = await prisma.$transaction(async (tx) => {
      // Get max order index in that status column
      const highestTask = await tx.task.findFirst({
        where: {
          projectId: validated.projectId,
          status: validated.status,
        },
        orderBy: { orderIndex: 'desc' },
      });

      const nextOrderIndex = highestTask ? highestTask.orderIndex + 1000 : 1000;

      const created = await tx.task.create({
        data: {
          projectId: validated.projectId,
          title: validated.title.trim(),
          description: validated.description?.trim(),
          status: validated.status,
          priority: validated.priority,
          assigneeId: validated.assigneeId,
          createdById: userId,
          dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
          orderIndex: nextOrderIndex,
        },
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
      });

      const act = await tx.activity.create({
        data: {
          workspaceId: project.workspaceId,
          userId,
          entityType: 'TASK',
          entityId: created.id,
          action: 'CREATED',
          metadata: { title: created.title, status: created.status },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      return { task: created, activity: act };
    });

    // Post-commit side effects: broadcasts, notifications, reminders, cache
    emitToWorkspace(project.workspaceId, 'task:created', task);
    emitToWorkspace(project.workspaceId, 'activity:logged', activity);

    if (task.assigneeId && task.assigneeId !== userId) {
      await createNotification(task.assigneeId, {
        type: 'TASK_ASSIGNED',
        title: 'New Task Assigned',
        message: `${req.user!.name} assigned you: "${task.title}"`,
        link: `/workspace?task=${task.id}`,
      });
    }

    if (task.dueDate && task.assigneeId && task.status !== 'DONE') {
      await scheduleTaskReminder({
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: task.assigneeId,
        assigneeEmail: task.assignee?.email,
        workspaceId: project.workspaceId,
        dueDate: task.dueDate.toISOString(),
      });
    }

    await deleteCache(`cache:project:${validated.projectId}`);

    res.status(201).json({ task });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

export const getTaskById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, workspaceId: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        attachments: {
          include: {
            uploader: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify workspace authorization
    const membership = await verifyWorkspaceMembership(userId, task.project.workspaceId);
    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task details' });
  }
};

export const updateTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validated = updateTaskSchema.parse(req.body);

    const existingTask = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existingTask) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify requesting user is in the workspace
    const membership = await verifyWorkspaceMembership(userId, existingTask.project.workspaceId);
    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    // Verify target assignee belongs to workspace if changed
    if (validated.assigneeId !== undefined && validated.assigneeId !== null) {
      const isAssigneeMember = await verifyAssigneeBelongsToWorkspace(
        existingTask.project.workspaceId,
        validated.assigneeId
      );
      if (!isAssigneeMember) {
        res.status(400).json({ error: 'Assignee must be a member of this workspace' });
        return;
      }
    }

    const statusChanged = validated.status !== undefined && validated.status !== existingTask.status;
    const assigneeChanged = validated.assigneeId !== undefined && validated.assigneeId !== existingTask.assigneeId;
    const dueDateChanged =
      validated.dueDate !== undefined &&
      (validated.dueDate ? new Date(validated.dueDate).getTime() : null) !==
        (existingTask.dueDate ? existingTask.dueDate.getTime() : null);
    const titleChanged = validated.title !== undefined && validated.title.trim() !== existingTask.title;

    // Atomic transaction: task update + activity records
    const { task: updatedTask, activities } = await prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: { id },
        data: {
          ...(validated.title !== undefined && { title: validated.title.trim() }),
          ...(validated.description !== undefined && { description: validated.description?.trim() }),
          ...(validated.status !== undefined && { status: validated.status }),
          ...(validated.priority !== undefined && { priority: validated.priority }),
          ...(validated.assigneeId !== undefined && { assigneeId: validated.assigneeId }),
          ...(validated.orderIndex !== undefined && { orderIndex: validated.orderIndex }),
          ...(validated.dueDate !== undefined && {
            dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
          }),
        },
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
      });

      const loggedActivities = [];

      if (statusChanged && validated.status) {
        const act = await tx.activity.create({
          data: {
            workspaceId: existingTask.project.workspaceId,
            userId,
            entityType: 'TASK',
            entityId: id,
            action: 'STATUS_CHANGED',
            metadata: {
              title: existingTask.title,
              from: existingTask.status,
              to: validated.status,
            },
          },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        });
        loggedActivities.push(act);
      }

      if (assigneeChanged) {
        const act = await tx.activity.create({
          data: {
            workspaceId: existingTask.project.workspaceId,
            userId,
            entityType: 'TASK',
            entityId: id,
            action: 'ASSIGNED',
            metadata: {
              title: existingTask.title,
              assigneeId: validated.assigneeId,
            },
          },
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        });
        loggedActivities.push(act);
      }

      return { task: updated, activities: loggedActivities };
    });

    // Post-commit side effects: real-time updates and activity broadcasts
    emitToWorkspace(existingTask.project.workspaceId, 'task:updated', updatedTask);
    for (const act of activities) {
      emitToWorkspace(existingTask.project.workspaceId, 'activity:logged', act);
    }

    if (
      validated.assigneeId &&
      validated.assigneeId !== userId &&
      assigneeChanged
    ) {
      await createNotification(validated.assigneeId, {
        type: 'TASK_ASSIGNED',
        title: 'Task Assigned To You',
        message: `${req.user!.name} assigned you to "${updatedTask.title}"`,
        link: `/workspace?task=${updatedTask.id}`,
      });
    }

    // Consistent background reminder queue lifecycle:
    // If task is completed (DONE) or unassigned or due date cleared: cancel existing reminder
    if (updatedTask.status === 'DONE' || !updatedTask.dueDate || !updatedTask.assigneeId) {
      await cancelTaskReminder(updatedTask.id);
    } else if (dueDateChanged || assigneeChanged || titleChanged || statusChanged) {
      // If reminder-relevant fields changed, cancel old reminder and schedule new reminder
      await cancelTaskReminder(updatedTask.id);
      await scheduleTaskReminder({
        taskId: updatedTask.id,
        taskTitle: updatedTask.title,
        assigneeId: updatedTask.assigneeId,
        assigneeEmail: updatedTask.assignee?.email,
        workspaceId: existingTask.project.workspaceId,
        dueDate: updatedTask.dueDate.toISOString(),
      });
    }

    // Invalidate Redis cached project data
    await deleteCache(`cache:project:${existingTask.projectId}`);

    res.json({ task: updatedTask });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify workspace membership authorization
    const membership = await verifyWorkspaceMembership(userId, task.project.workspaceId);
    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    // Atomic transaction: log deletion activity and delete task
    const { activity } = await prisma.$transaction(async (tx) => {
      const act = await tx.activity.create({
        data: {
          workspaceId: task.project.workspaceId,
          userId,
          entityType: 'TASK',
          entityId: id,
          action: 'DELETED',
          metadata: { title: task.title },
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatar: true } },
        },
      });

      await tx.task.delete({ where: { id } });

      return { activity: act };
    });

    // Post-commit side effects: cancel reminder, broadcast deletion, delete cache
    await cancelTaskReminder(id);

    emitToWorkspace(task.project.workspaceId, 'task:deleted', {
      taskId: id,
      projectId: task.projectId,
    });
    emitToWorkspace(task.project.workspaceId, 'activity:logged', activity);

    await deleteCache(`cache:project:${task.projectId}`);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

export const addComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user!.id;
    const validated = addCommentSchema.parse(req.body);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify workspace membership authorization
    const membership = await verifyWorkspaceMembership(userId, task.project.workspaceId);
    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    // Atomic transaction: comment creation + activity record logging
    const { comment, activity } = await prisma.$transaction(async (tx) => {
      const createdComment = await tx.taskComment.create({
        data: {
          taskId,
          userId,
          content: validated.content.trim(),
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      const act = await tx.activity.create({
        data: {
          workspaceId: task.project.workspaceId,
          userId,
          entityType: 'COMMENT',
          entityId: createdComment.id,
          action: 'COMMENTED',
          metadata: { taskTitle: task.title, commentSnippet: createdComment.content.slice(0, 50) },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });

      return { comment: createdComment, activity: act };
    });

    // Post-commit side effects: broadcasts, notifications, cache invalidation
    emitToWorkspace(task.project.workspaceId, 'comment:created', {
      taskId,
      comment,
    });
    emitToWorkspace(task.project.workspaceId, 'activity:logged', activity);

    if (task.assigneeId && task.assigneeId !== userId) {
      await createNotification(task.assigneeId, {
        type: 'TASK_COMMENT',
        title: 'New Comment On Task',
        message: `${req.user!.name} commented on "${task.title}": ${comment.content.slice(0, 50)}`,
        link: `/workspace?task=${task.id}`,
      });
    }

    await deleteCache(`cache:project:${task.projectId}`);

    res.status(201).json({ comment });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
};

export const searchTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { workspaceId, q } = req.query;
    const userId = req.user!.id;

    if (!workspaceId || !q || typeof q !== 'string') {
      res.json({ tasks: [] });
      return;
    }

    const membership = await verifyWorkspaceMembership(userId, workspaceId as string);
    if (!membership) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    const query = q.trim();

    const tasks = await prisma.task.findMany({
      where: {
        project: { workspaceId: workspaceId as string },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
      },
      take: 8,
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Search tasks error:', error);
    res.status(500).json({ error: 'Failed to search tasks' });
  }
};
