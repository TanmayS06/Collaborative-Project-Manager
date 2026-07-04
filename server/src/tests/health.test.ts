import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';

describe('Health and System Status API', () => {
  it('GET /api/health should return 200 with service information and readiness states', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'SyncSphere API');
    expect(res.body).toHaveProperty('realtime', 'Socket.IO ready');
    expect(res.body).toHaveProperty('cache');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/nonexistent-route should return 404', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
  });
});
