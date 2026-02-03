const request = require('supertest');
const app = require('../service');
const { createAdminUser, registerAdminUser } = require('./testUtils');
const { DB, Role } = require('../database/database.js');

beforeAll(async () => {
    await createAdminUser();
});

test('get menu', async () => {

  const orderRes = await request(app)
    .get('/api/order/menu');

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

test('add menu item unauthorized', async () => {

  const newMenuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };

  const orderRes = await request(app)
    .put('/api/order/menu')
    .send(newMenuItem);

  expect(orderRes.status).toBe(401);
  expect(orderRes.body.message).toBe('unauthorized');
});

test('add menu item success', async () => {
  let adminRes = await registerAdminUser();
  expect(adminRes.status).toBe(200);
  let token = adminRes.body.token;
  expect(token).toBeDefined();

  const newMenuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };
  
  const orderRes = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${token}`)
    .send(newMenuItem);

  expect(orderRes.status).toBe(200);
  expect(orderRes.body).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: expect.any(Number),
      title: 'Student',
      image: 'pizza9.png',
      description: 'No topping, no sauce, just carbs',
      price: 0.0001,
    })
  ]));

});

