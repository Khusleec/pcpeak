const crypto = require('crypto');
const request = require('supertest');
const pool = require('../src/db/pool');

let app;

beforeAll(() => {
  app = require('../src/index');
});

afterAll(async () => {
  await pool.end().catch(() => {});
  // Give it a moment to truly settle if needed
  await new Promise(r => setTimeout(r, 500));
});

describe('forgot password flow', () => {
  test('should register, request reset, and change password', async () => {
    const suffix = crypto.randomBytes(6).toString('hex');
    const email = `test.${suffix}@example.com`;
    const password = 'old-password-123';
    const newPassword = 'new-password-456';

    // 1. Register
    await request(app)
      .post('/api/auth/register')
      .send({
        email,
        password,
        display_name: `Test User ${suffix}`,
      })
      .expect(201);

    // 2. Request forgot password
    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email })
      .expect(200);

    // 3. Get token from DB (since we are testing)
    const { rows: tokens } = await pool.query(
      'SELECT token FROM password_reset_tokens WHERE used = 0 ORDER BY created_at DESC LIMIT 1'
    );
    const token = tokens[0]?.token;
    expect(token).toBeDefined();

    // 4. Reset password
    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token,
        password: newPassword,
      })
      .expect(200);

    // 5. Try login with old password (should fail)
    await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(401);

    // 6. Try login with new password (should succeed)
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: newPassword })
      .expect(200);
    expect(login.body.token).toBeDefined();
  }, 30000);
});
