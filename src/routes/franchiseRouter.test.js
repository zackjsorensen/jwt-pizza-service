const request = require('supertest');
const app = require('../service');
const { createAdminUser, registerAdminUser, startSession } = require('./testUtils');

let adminRes;

beforeAll(async () => {
    adminRes = await registerAdminUser();
});

// apparently we can have a franchise with no admin
// Will that be a problem??
test('get franchises list', async () => {

  const franchiseRes = await request(app)
    .get('/api/franchise');
    expect(franchiseRes.status).toBe(200);
    expect(franchiseRes.body.franchises).toEqual(expect.arrayContaining([
        {
            name: expect.any(String),
            id: expect.any(Number),
            stores: expect.any(Array)
    }]));
});

test('create franchise unauthorized', async () => {

  const newFranchise = { name: 'New Franchise', admins: [{email: "f@jwt.ocm"}]};
    const franchiseRes = await request(app).post('/api/franchise')
    .send(newFranchise);

    expect(franchiseRes.status).toBe(401);
    expect(franchiseRes.body.message).toBe('unauthorized');
});

test('create franchise success', async () => {
  let token = adminRes.body.token;
  expect(token).toBeDefined();

  const newFranchise = { name: 'New Franchise', admins: [{email: adminRes.body.user.email}]};
    const franchiseRes = await request(app).post('/api/franchise')
    .set('Authorization', `Bearer ${token}`)
    .send(newFranchise);

    expect(franchiseRes.status).toBe(200);
    expect(franchiseRes.body).toEqual(expect.objectContaining({
        name: 'New Franchise',
        admins: expect.any(Array)
    }));
});

