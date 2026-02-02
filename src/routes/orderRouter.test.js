const request = require('supertest');
const app = require('../service');
const { login } = require('./testUtils');

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

