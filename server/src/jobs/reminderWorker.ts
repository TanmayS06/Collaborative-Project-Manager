import { Worker, Job } from 'bullmq';
import { redis, isRedisReady } from '../config/redis';
import prisma from '../config/prisma';
import { emitToUser } from '../socket';
import { ReminderJobData } from './reminderQueue';

let reminderWorker: Worker<ReminderJobData> | null = null;

export const initReminderWorker = (): Worker<ReminderJobData> | null => {
  if (!isRedisReady()) {
    console.log('ℹ️ [BullMQ Worker] Redis not connected — worker standing by in passive mode');
    return null;
  }

  if (reminderWorker) return reminderWorker;

  try {
    reminderWorker = new Worker<ReminderJobData>(
      'task-reminders',
      async (job: Job<ReminderJobData>) => {
        const { taskId, taskTitle, assigneeId, assigneeEmail } = job.data;

        console.log(`⚡ [BullMQ Worker] Processing reminder for task "${taskTitle}" (${taskId})`);

        // Check current status in DB
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          include: {
            assignee: true,
            project: true,
          },
        });

        if (!task) {
          console.log(`ℹ️ [BullMQ Worker] Task ${taskId} no longer exists, skipping reminder.`);
          return;
        }

        if (task.status === 'DONE') {
          console.log(`✅ [BullMQ Worker] Task "${task.title}" is already DONE, skipping reminder.`);
          return;
        }

        // 1. Create in-app notification in PostgreSQL
        const notification = await prisma.notification.create({
          data: {
            userId: assigneeId,
            type: 'TASK_DUE_SOON',
            title: 'Task Due Soon',
            message: `Task "${task.title}" is due soon! Don't forget to update your progress.`,
            link: `/workspace?task=${task.id}`,
          },
        });

        // 2. Real-time push via Socket.IO
        emitToUser(assigneeId, 'notification:received', notification);

        // 3. Simulated Email Service (Background job pattern)
        const recipientEmail = assigneeEmail || task.assignee?.email || 'user@example.com';
        console.log(`📧 [BullMQ Email Dispatcher] Sent reminder email to <${recipientEmail}>:`);
        console.log(`   Subject: Reminder: Task "${task.title}" is due soon`);
        console.log(`   Project: ${task.project.name} | Status: ${task.status}`);

        return { success: true, notifiedUserId: assigneeId };
      },
      {
        connection: {
          host: redis.options.host || '127.0.0.1',
          port: redis.options.port || 6379,
          password: redis.options.password,
        },
        concurrency: 5,
      }
    );

    reminderWorker.on('completed', (job: Job) => {
      console.log(`🎉 [BullMQ Worker] Job ${job.id} completed successfully`);
    });

    reminderWorker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`❌ [BullMQ Worker] Job ${job?.id} failed:`, err.message);
    });

    reminderWorker.on('error', (err: Error) => {
      // Non-fatal if local Redis is down
      if (!err.message.includes('ECONNREFUSED')) {
        console.warn('⚠️ [BullMQ Worker Error]:', err.message);
      }
    });

    console.log('🚀 [BullMQ Worker] Task reminder background worker initialized');
    return reminderWorker;
  } catch (err) {
    console.warn('[BullMQ Worker Warning] Could not start worker:', (err as Error).message);
    return null;
  }
};
