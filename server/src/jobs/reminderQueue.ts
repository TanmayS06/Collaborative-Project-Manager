import { Queue } from 'bullmq';
import { redis, isRedisReady } from '../config/redis';

export interface ReminderJobData {
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  assigneeEmail?: string;
  workspaceId: string;
  dueDate: string;
}

let reminderQueue: Queue<ReminderJobData> | null = null;

export const getReminderQueue = (): Queue<ReminderJobData> | null => {
  if (!isRedisReady()) {
    return null;
  }

  if (!reminderQueue) {
    try {
      reminderQueue = new Queue<ReminderJobData>('task-reminders', {
        // BullMQ requires a dedicated ioredis instance or connection options
        connection: {
          host: redis.options.host || '127.0.0.1',
          port: redis.options.port || 6379,
          password: redis.options.password,
        },
      });
    } catch (err) {
      console.warn('[BullMQ Warning] Failed to initialize reminder queue:', (err as Error).message);
      return null;
    }
  }

  return reminderQueue;
};

/**
 * Schedule a background reminder job for a task
 */
export const scheduleTaskReminder = async (data: ReminderJobData): Promise<void> => {
  try {
    const queue = getReminderQueue();
    if (!queue) {
      // In development or when Redis is offline, log gracefully
      console.log(`ℹ️ [BullMQ Queue] Redis queue offline - skipping background reminder for task "${data.taskTitle}"`);
      return;
    }

    const dueDateObj = new Date(data.dueDate);
    const now = Date.now();
    // Schedule reminder 24 hours before due date (or 10 seconds from now for testing if due soon)
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const targetReminderTime = dueDateObj.getTime() - twentyFourHoursMs;
    const delay = Math.max(1000, targetReminderTime - now);

    const jobId = `reminder-${data.taskId}`;

    // Remove existing reminder for this task if rescheduling
    await queue.remove(jobId).catch(() => {});

    await queue.add('due-date-reminder', data, {
      jobId,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });

    console.log(`⏰ [BullMQ Queue] Scheduled reminder for task "${data.taskTitle}" in ${Math.round(delay / 1000)}s`);
  } catch (err) {
    console.warn('[BullMQ Queue Warning] Could not schedule reminder job:', (err as Error).message);
  }
};
