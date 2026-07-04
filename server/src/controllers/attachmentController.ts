import { Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';
import { storeUploadedFile, deleteStoredFile } from '../services/storageService';
import { recordActivity } from '../services/activityService';
import { emitToWorkspace } from '../socket';
import { deleteCache } from '../services/cacheService';

export const uploadAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user!.id;

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: {
            workspace: {
              include: { members: true },
            },
          },
        },
      },
    });

    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Verify membership
    const isMember = task.project.workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    // Construct server base URL for file access
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:5000';
    const baseUrl = `${protocol}://${host}`;

    // Store file in object storage / disk
    const stored = await storeUploadedFile(req.file, baseUrl);

    // Save attachment in database
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        fileName: stored.fileName,
        fileSize: stored.fileSize,
        fileType: stored.fileType,
        fileUrl: stored.fileUrl,
        fileKey: stored.fileKey,
        uploadedBy: userId,
      },
      include: {
        uploader: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    // Record activity audit log
    await recordActivity({
      workspaceId: task.project.workspaceId,
      userId,
      entityType: 'ATTACHMENT',
      entityId: attachment.id,
      action: 'ADDED',
      metadata: { taskTitle: task.title, fileName: attachment.fileName, fileSize: attachment.fileSize },
    });

    // Invalidate project cache
    await deleteCache(`cache:project:${task.projectId}`);

    // Real-time broadcast to all workspace members
    emitToWorkspace(task.project.workspaceId, 'attachment:added', {
      taskId,
      attachment,
    });

    res.status(201).json({ attachment });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
};

export const deleteAttachment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: taskId, attachmentId } = req.params;
    const userId = req.user!.id;

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        task: {
          include: {
            project: {
              include: {
                workspace: {
                  include: { members: true },
                },
              },
            },
          },
        },
      },
    });

    if (!attachment || attachment.taskId !== taskId) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const workspace = attachment.task.project.workspace;
    const isMember = workspace.members.some((m) => m.userId === userId);
    if (!isMember) {
      res.status(403).json({ error: 'Access denied: You are not a member of this workspace' });
      return;
    }

    // Delete stored file
    await deleteStoredFile(attachment.fileKey);

    // Delete database record
    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    // Record activity audit log
    await recordActivity({
      workspaceId: workspace.id,
      userId,
      entityType: 'ATTACHMENT',
      entityId: attachmentId,
      action: 'DELETED',
      metadata: { taskTitle: attachment.task.title, fileName: attachment.fileName },
    });

    // Invalidate project cache
    await deleteCache(`cache:project:${attachment.task.projectId}`);

    // Real-time broadcast to all workspace members
    emitToWorkspace(workspace.id, 'attachment:deleted', {
      taskId,
      attachmentId,
    });

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
};
