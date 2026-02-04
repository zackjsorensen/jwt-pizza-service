const request = require('supertest');
const app = require('../service');
const { createAdminUser, registerAdminUser, startSession } = require('./testUtils');

let adminRes;

beforeAll(async () => {
    await createAdminUser();
    adminRes = await registerAdminUser();
    expect(adminRes.status).toBe(200);
    let menuRes = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${adminRes.body.token}`)
      .send({ title: 'Veggie', description: 'Loaded with veggies', image: 'pizza1.png', price: 0.05 });

    expect(menuRes.status).toBe(200);
});

test('get menu', async () => {

  const orderRes = await request(app)
    .get('/api/order/menu');

  expect(orderRes.status).toBe(200);
  expect(orderRes.body).toBeDefined();
  expect(Array.isArray(orderRes.body)).toBe(true);

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
  // let adminRes = await registerAdminUser();
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

test('create order', async () => {
  let testUser = await startSession();
  let dinerRes = await request(app)
    .post('/api/order')
    .send({"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}).set('Authorization', `Bearer ${testUser.token}`);
  expect(dinerRes.status).toBe(200);
  //  response: { order: { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }], id: 1 }, jwt: '1111111111' },
  expect(dinerRes.body).toBeDefined();
  expect(dinerRes.body.jwt).toBeDefined();
  expect(dinerRes.body).toEqual(expect.objectContaining({ 
      // franchiseId: expect.any(Number), 
      // storeId: expect.any(Number),
      // items: expect.any(Array),
      jwt: expect.any(String)
    }));

});