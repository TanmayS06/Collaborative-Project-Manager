import type { User, Workspace, Project, Task, TaskComment, WorkspaceRole, Notification, TaskAttachment } from '../types';

const API_BASE = '/api';


class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('syncsphere_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Network request failed');
    }

    return data as T;
  }

  // Auth
  async register(data: { name: string; email: string; password: string }) {
    return this.request<{ message: string; token: string; user: User; defaultWorkspaceId?: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ message: string; token: string; user: User }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getMe() {
    return this.request<{ user: User }>('/auth/me');
  }

  // Workspaces
  async getWorkspaces() {
    return this.request<{ workspaces: Workspace[] }>('/workspaces');
  }

  async getWorkspaceById(id: string) {
    return this.request<{ workspace: Workspace; currentUserRole: WorkspaceRole }>(`/workspaces/${id}`);
  }

  async createWorkspace(data: { name: string; description?: string }) {
    return this.request<{ workspace: Workspace }>('/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addWorkspaceMember(workspaceId: string, data: { email: string; role: WorkspaceRole }) {
    return this.request<{ member: any; message: string }>(`/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Projects
  async createProject(data: { workspaceId: string; name: string; description?: string }) {
    return this.request<{ project: Project }>('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getProjectById(id: string) {
    return this.request<{ project: Project & { tasks: Task[]; workspace: Workspace } }>(`/projects/${id}`);
  }

  // Tasks
  async createTask(data: {
    projectId: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    assigneeId?: string | null;
    dueDate?: string | null;
  }) {
    return this.request<{ task: Task }>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getTaskById(id: string) {
    return this.request<{ task: Task }>(`/tasks/${id}`);
  }

  async updateTask(
    id: string,
    data: Partial<{
      title: string;
      description: string | null;
      status: string;
      priority: string;
      assigneeId: string | null;
      dueDate: string | null;
      orderIndex: number;
    }>
  ) {
    return this.request<{ task: Task }>(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id: string) {
    return this.request<{ message: string }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async addComment(taskId: string, content: string) {
    return this.request<{ comment: TaskComment }>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async searchTasks(workspaceId: string, query: string) {
    const params = new URLSearchParams({ workspaceId, q: query });
    return this.request<{ tasks: (Task & { project: { id: string; name: string } })[] }>(
      `/tasks/search?${params.toString()}`
    );
  }

  // Attachments
  async uploadAttachment(taskId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<{ attachment: TaskAttachment }>(`/tasks/${taskId}/attachments`, {
      method: 'POST',
      body: formData,
    });
  }

  async deleteAttachment(taskId: string, attachmentId: string) {
    return this.request<{ message: string }>(`/tasks/${taskId}/attachments/${attachmentId}`, {
      method: 'DELETE',
    });
  }

  // Notifications
  async getNotifications() {
    return this.request<{ notifications: Notification[]; unreadCount: number }>('/notifications');
  }

  async markNotificationRead(id: string) {
    return this.request<{ notification: Notification }>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ message: string }>('/notifications/read-all', {
      method: 'PATCH',
    });
  }
}

export const api = new ApiClient();

