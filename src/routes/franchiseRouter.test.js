const request = require('supertest');
const app = require('../service');
const { registerAdminUser, startSession, randomName } = require('./testUtils');

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

test('create franchise nonadmin', async () => {
  let testUser = await startSession();
  const franchiseName = randomName();
  const newFranchise = { name: franchiseName, admins: [{ email: testUser.email }] };
    const franchiseRes = await request(app).post('/api/franchise')
    .set('Authorization', `Bearer ${testUser.token}`)
    .send(newFranchise);

    expect(franchiseRes.status).toBe(403);
    expect(franchiseRes.body.message).toBe('unable to create a franchise');
});

test('delete franchise', async () => {
  // create a franchise to delete
  const franchiseName = randomName();
  const newFranchise = { name: franchiseName, admins: [{ email: adminRes.body.user.email }] };
    const franchiseRes = await request(app).post('/api/franchise')
    .set('Authorization', `Bearer ${adminRes.body.token}`)
    .send(newFranchise);

    expect(franchiseRes.status).toBe(200);
    const franchiseId = franchiseRes.body.id;

    // now delete it
    const deleteRes = await request(app).delete(`/api/franchise/:${franchiseId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('franchise deleted');
});

test('get user franchises', async () => {
  // need unique admin user
  const newAdmin = await registerAdminUser();
  expect(newAdmin.status).toBe(200);

  // create a franchise for them
  const franchiseName = randomName();
  const newFranchise = { name: franchiseName, admins: [{ email: newAdmin.body.user.email }] };
    const franchiseRes = await request(app).post('/api/franchise')
    .set('Authorization', `Bearer ${newAdmin.body.token}`)
    .send(newFranchise);

    expect(franchiseRes.status).toBe(200);
    const userId = newAdmin.body.user.id;
    // now get it
    const getRes = await request(app).get(`/api/franchise/${userId}`)
    .set('Authorization', `Bearer ${newAdmin.body.token}`);

    expect(getRes.status).toBe(200);
    console.log('getRes body', getRes.body);
    expect(getRes.body).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      id: expect.any(Number),
      name: franchiseName,
      admins: expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          name: newAdmin.body.user.name,
          email: newAdmin.body.user.email
        })
      ])
    })
  ])
);

});


test('create franchise store', async () => {
  // create a franchise to add store to
  const franchiseName = randomName();
  const newFranchise = { name: franchiseName, admins: [{ email: adminRes.body.user.email }] };
    const franchiseRes = await request(app).post('/api/franchise')
    .set('Authorization', `Bearer ${adminRes.body.token}`)
    .send(newFranchise);

    expect(franchiseRes.status).toBe(200);
    const franchiseId = franchiseRes.body.id;

    // now add store
    const storeName = randomName();
    const newStore = { name: storeName, location: '123 Main St' };
    const storeRes = await request(app).post(`/api/franchise/${franchiseId}/store`)
    .set('Authorization', `Bearer ${adminRes.body.token}`)
    .send(newStore);

    expect(storeRes.status).toBe(200);
    expect(storeRes.body).toEqual(expect.objectContaining({
        id: expect.any(Number),
        franchiseId: franchiseId,
        name: storeName,
    }));

    // now delete store
    const storeId = storeRes.body.id;
    const deleteRes = await request(app).delete(`/api/franchise/${franchiseId}/store/${storeId}`)
    .set('Authorization', `Bearer ${adminRes.body.token}`);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe('store deleted');
});