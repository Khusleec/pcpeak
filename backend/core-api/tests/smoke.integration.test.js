/**
 * Integration: seeded MySQL (see README + CI workflow).
 */
const crypto = require('crypto');
const request = require('supertest');

const pool = require('../src/db/pool');

let app;

beforeAll(() => {
  app = require('../src/index');
});

afterAll(async () => {
  await pool.end().catch(() => {});
});

describe('integration: auth / oauth / bookings', () => {
  let token;
  let userId;

  test('register + login flow', async () => {
    const suffix = crypto.randomBytes(6).toString('hex');
    const email = `smoke.${suffix}@example.test`;
    const body = {
      email,
      password: 'smoke-password-ok-8chars',
      display_name: `Smoke User ${suffix}`,
    };

    const reg = await request(app).post('/api/auth/register').send(body).expect(201);
    expect(reg.body.token).toBeDefined();
    expect(reg.body.user.id).toBeDefined();
    token = reg.body.token;
    userId = reg.body.user.id;

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email, password: body.password })
      .expect(200);
    expect(login.body.token).toBeDefined();
  });

  test('OAuth code exchange yields JWT without token in redirect URL', async () => {
    expect(token).toBeTruthy();
    const code = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO oauth_exchange_codes (code, user_id, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
      [code, userId]
    );

    const res = await request(app).post('/api/auth/oauth/exchange').send({ code }).expect(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toContain('@example.test');
  });

  test('create booking (seeded PCs)', async () => {
    expect(token).toBeTruthy();

    const cafes = await request(app).get('/api/cafes').expect(200);
    expect(Array.isArray(cafes.body)).toBe(true);
    expect(cafes.body.length).toBeGreaterThan(0);
    const cafeId = cafes.body[0].id;

    const pcs = await request(app).get(`/api/pcs/cafe/${cafeId}`).expect(200);
    const groups = pcs.body;
    expect(Array.isArray(groups)).toBe(true);
    const flat = groups.flatMap((g) =>
      g.pcs.filter((p) => p.is_available !== false).map((p) => p.id)
    );
    expect(flat.length).toBeGreaterThan(0);

    const starts = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const ends = new Date(Date.now() + 48 * 3600 * 1000 + 2 * 3600 * 1000).toISOString();

    const book = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({
        cafe_id: cafeId,
        pc_ids: [flat[0]],
        starts_at: starts,
        ends_at: ends,
      })
      .expect(201);

    expect(book.body.booking).toBeDefined();
    expect(book.body.booking.id).toBeDefined();
  });

  test('list tournaments (public)', async () => {
    const res = await request(app).get('/api/tournaments').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('create tournament (auth)', async () => {
    expect(token).toBeTruthy();
    const cafes = await request(app).get('/api/cafes').expect(200);
    expect(cafes.body.length).toBeGreaterThan(0);
    const cafeId = cafes.body[0].id;
    const starts = new Date(Date.now() + 7 * 86400000).toISOString();
    const ends = new Date(Date.now() + 7 * 86400000 + 4 * 3600000).toISOString();
    const res = await request(app)
      .post('/api/tournaments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Smoke Cup ${crypto.randomBytes(4).toString('hex')}`,
        game_title: 'Valorant',
        cafe_id: cafeId,
        starts_at: starts,
        ends_at: ends,
        max_participants: 16,
        prize_pool_mnt: 100000,
        visibility: 'public',
        setup_mode: 'manual',
        bracket_type: 'elimination',
      })
      .expect(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.created_by).toBe(userId);
  });
});
