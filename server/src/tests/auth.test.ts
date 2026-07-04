import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Prisma client for deterministic, unit-level testing without external DB connection
vi.mock('../config/prisma', () => {
  return {
    default: {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.email === 'registered@example.com') {
            return Promise.resolve({
              id: '11111111-1111-1111-1111-111111111111',
              name: 'Registered User',
              email: 'registered@example.com',
              // bcrypt hash for "Password123!"
              passwordHash: '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lR0J5j4u4wZ1gZ0sE2xV3iX5.s5K.',
              avatar: null,
            });
          }
          return Promise.resolve(null);
        }),
        create: vi.fn().mockImplementation(({ data }) => {
          return Promise.resolve({
            id: '22222222-2222-2222-2222-222222222222',
            name: data.name,
            email: data.email,
            avatar: null,
          });
        }),
      },
      workspace: {
        create: vi.fn().mockResolvedValue({
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Personal Workspace',
        }),
      },
      project: {
        create: vi.fn().mockResolvedValue({
          id: '44444444-4444-4444-4444-444444444444',
          name: 'Starter Project',
        }),
      },
      workspaceMember: {
        create: vi.fn().mockResolvedValue({}),
      },
      activity: {
        create: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

import app from '../server';

describe('Authentication & Authorization Tests', () => {
  describe('POST /api/auth/register', () => {
    it('should reject registration if email is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Invalid Email User',
          email: 'not-an-email',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration if password is too short', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Password User',
          email: 'short@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration if name is missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'noname@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should successfully register a valid new user and return JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Valid New User',
          email: 'newuser@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user).toHaveProperty('email', 'newuser@example.com');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'ghost@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid email or password');
    });

    it('should reject login with missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('Protected Routes & RBAC Middleware', () => {
    it('should reject GET /api/workspaces without Authorization header (401)', async () => {
      const res = await request(app).get('/api/workspaces');
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject GET /api/projects/fake-id with malformed JWT token (403)', async () => {
      const res = await request(app)
        .get('/api/projects/some-fake-id')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject POST /api/tasks without Authorization header (401)', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .send({ title: 'Unauthorized Task' });

      expect(res.status).toBe(401);
    });
  });
});
