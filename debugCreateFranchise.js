const request = require('supertest');
const app = require('./src/service');
const { createAdminUser } = require('./src/routes/testUtils');

(async () => {
  try {
    // create admin user directly in DB
    const admin = await createAdminUser();
    // login
    const loginRes = await request(app).put('/api/auth').send({ email: admin.email, password: 'toomanysecrets' });
    console.log('login res status', loginRes.status);
    console.log('login body', loginRes.body);
    const token = loginRes.body.token;
    const newFranchise = { name: 'Debug Franchise', admins: [{ email: admin.email }] };
    const franchiseRes = await request(app).post('/api/franchise').set('Authorization', `Bearer ${token}`).send(newFranchise);
    console.log('franchise status', franchiseRes.status);
    console.log('franchise body', franchiseRes.body);
  } catch (err) {
    console.error('Script error', err.stack || err.message || err);
  }
})();
