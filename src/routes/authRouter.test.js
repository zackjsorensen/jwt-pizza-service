const request = require('supertest');
const app = require('../service');
const startSession = require('./testUtils').startSession;

let testUser;
let testUserAuthToken;

beforeAll(async () => {
  testUser = await startSession();
  testUserAuthToken = testUser.token;
  expectValidJwt(testUserAuthToken);
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expectValidJwt(loginRes.body.token);

  const expectedUser = { name: testUser.name, email: testUser.email, roles: [{ role: 'diner' }]};
  delete expectedUser.password;
  delete expectedUser.id;
  expect(loginRes.body.user).toMatchObject(expectedUser);

});

function expectValidJwt(potentialJwt) {
  expect(potentialJwt).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
}

test ('bad password login', async () => {
  const loginRes = await request(app).put('/api/auth').send({ email: testUser.email, password: 'wrong' });
  expect(loginRes.status).toBe(401);
  expect(loginRes.body.message).toBe('password incorrect');
});

test ('logout without login', async () => {
  const logoutRes = await request(app).delete('/api/auth');
  expect(logoutRes.status).toBe(401);
  expect(logoutRes.body.message).toBe('unauthorized');
});

test('logout', async () => {
  const logoutRes = await request(app)
    .delete('/api/auth')
    .set('Authorization', `Bearer ${testUserAuthToken}`);

  expect(logoutRes.status).toBe(200);
  expect(logoutRes.body).toEqual({ message: 'logout successful' });
});

test('get menu', async () => {

  const orderRes = await request(app)
    .get('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`);

  expect(orderRes.status).toBe(200);
  expect(orderRes.body.length).toBeGreaterThan(0);
  expect(orderRes.body).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: expect.any(Number),
      title: expect.any(String),
      image: expect.any(String),
      description: expect.any(String),
      price: expect.any(Number),
    })
  ]));
 
}); 