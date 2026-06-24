import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { AuthRequest } from '../middleware/auth';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const generateToken = (user: { id: string; email: string; name: string }) => {
  const secret = process.env.JWT_SECRET || 'syncsphere_jwt_secret_dev_key';
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    secret,
    { expiresIn: '7d' }
  );
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = registerSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    const user = await prisma.user.create({
      data: {
        name: validated.name.trim(),
        email: normalizedEmail,
        passwordHash,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(validated.name)}`,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
      },
    });

    // Automatically create a default onboarding workspace for the new user!
    const defaultWorkspace = await prisma.workspace.create({
      data: {
        name: `${user.name.split(' ')[0]}'s Workspace`,
        description: 'Personal agile workspace',
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    // Create a starter project
    await prisma.project.create({
      data: {
        workspaceId: defaultWorkspace.id,
        name: 'Starter Project',
        description: 'Track your first sprints and roadmap items',
        tasks: {
          create: [
            {
              title: 'Explore the Kanban Board',
              description: 'Drag this card across columns (TODO -> IN_PROGRESS -> DONE)',
              status: 'TODO',
              priority: 'MEDIUM',
              createdById: user.id,
              orderIndex: 0,
            },
            {
              title: 'Invite your teammates',
              description: 'Share your workspace and assign tasks to members',
              status: 'IN_PROGRESS',
              priority: 'HIGH',
              createdById: user.id,
              assigneeId: user.id,
              orderIndex: 0,
            },
            {
              title: 'Set up development environment',
              description: 'Full stack architecture initialized',
              status: 'DONE',
              priority: 'URGENT',
              createdById: user.id,
              orderIndex: 0,
            },
          ],
        },
      },
    });

    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user,
      defaultWorkspaceId: defaultWorkspace.id,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to create user account' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validated = loginSchema.parse(req.body);
    const normalizedEmail = validated.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
        memberships: {
          include: {
            workspace: {
              select: {
                id: true,
                name: true,
                description: true,
                ownerId: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};
