import prisma from '../config/prisma';
import { emitToWorkspace } from '../socket';

export interface CreateActivityParams {
  workspaceId: string;
  userId: string;
  entityType: 'TASK' | 'PROJECT' | 'WORKSPACE' | 'COMMENT' | 'MEMBER' | 'ATTACHMENT';
  entityId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'COMMENTED' | 'JOINED' | 'ADDED';
  metadata?: any;
  tx?: any;
  skipEmit?: boolean;
}

export const recordActivity = async (params: CreateActivityParams) => {
  try {
    const client = params.tx || prisma;
    const activity = await client.activity.create({
      data: {
        workspaceId: params.workspaceId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        metadata: params.metadata || {},
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    // Real-time broadcast to all connected workspace members (unless skipped for post-commit emission)
    if (!params.skipEmit) {
      emitToWorkspace(params.workspaceId, 'activity:logged', activity);
    }

    return activity;
  } catch (error) {
    console.error('Failed to log activity record:', error);
    // Non-blocking for primary operation
    return null;
  }
};

