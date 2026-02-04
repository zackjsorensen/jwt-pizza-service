const request = require('supertest');
const app = require('../service');
const { createAdminUser, registerAdminUser, startSession, randomName } = require('./testUtils');
const { Role, DB } = require('../database/database.js');

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


// was failing bc can't have duplicate franchise names in mysql
test('create franchise success', async () => {
  expect(adminRes.status).toBe(200);
  let token = adminRes.body.token;
  expect(token).toBeDefined();

  // const newFranchise = { name: 'New Franchise'};
    const franchiseName = randomName();
    const newFranchise = {"name": franchiseName, "admins": [{"email": adminRes.body.user.email}]};
    const franchiseRes = await request(app).post('/api/franchise')
    .set('Authorization', `Bearer ${token}`)
    .send(newFranchise);

    expect(franchiseRes.status).toBe(200);
    expect(franchiseRes.body).toEqual(expect.objectContaining({
        name: franchiseName,
        admins: expect.any(Array)
    }));
});

