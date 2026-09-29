export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  createdAt?: string;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  user: User;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  userId: string;
  user: User;
  entityType: 'TASK' | 'PROJECT' | 'WORKSPACE' | 'COMMENT' | 'MEMBER' | 'ATTACHMENT';
  entityId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'COMMENTED' | 'JOINED' | 'ADDED';
  metadata?: any;
  createdAt: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tasks: number;
  };
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user: User;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  orderIndex: number;
  assigneeId?: string | null;
  assignee?: User | null;
  createdById: string;
  createdBy?: User;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  _count?: {
    comments: number;
  };
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  uploadedBy: string;
  uploader?: User;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  owner?: User;
  members: WorkspaceMember[];
  projects?: Project[];
  activities?: Activity[];
  _count?: {
    projects: number;
    members: number;
  };
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface OnlineUser {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

