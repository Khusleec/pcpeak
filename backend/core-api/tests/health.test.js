/** No DB required — hits /api/health only */
const request = require('supertest');

let app;

beforeAll(() => {
  app = require('../src/index');
});

test('GET /api/health', async () => {
  const res = await request(app).get('/api/health').expect(200);
  expect(res.body.status).toBe('ok');
});
