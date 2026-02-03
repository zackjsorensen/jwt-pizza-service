const request = require("supertest");
const app = require("../service");
const { DB, Role } = require('../database/database.js');

// register a user to use for test, get user back with auth token
const startSession = async () => {
    let email = Math.random().toString(36).substring(2, 12) + "@test.com";
    let testUser = { name: "pizza diner", email: email, password: "a" };
    const registerRes = await request(app).post("/api/auth").send(testUser);
    testUser.token = registerRes.body.token;
    return testUser;
};

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

// register admin user for test
async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  user = await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
}

async function registerAdminUser() {
  const admin = await createAdminUser();
  const adminLoginRes = await request(app)
    .put('/api/auth')
    .send({ email: admin.email, password: admin.password });
  return adminLoginRes;
}

async function getActiveAdminUser(){
  const adminToken = await registerAdminUserAndGetToken();
  
}

module.exports = { startSession, randomName, createAdminUser, registerAdminUser };
