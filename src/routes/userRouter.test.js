const request = require("supertest");
const app = require("../service");
const { registerAdminUser, startSession, randomName } = require("./testUtils");

let testUser;
let adminRes;

beforeAll(async () => {
    testUser = await startSession();
    adminRes = await registerAdminUser();
});

test("update user success", async () => {
    expect(testUser).toBeDefined();
    expect(adminRes.status).toBe(200);
    const newName = randomName();
    console.log("testUser:", testUser);
    const updateRes = await request(app)
        .put(`/api/user/${testUser.id}`)
        .set("Authorization", `Bearer ${adminRes.body.token}`)
        .send({ name: newName, email: testUser.email, password: testUser.password });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.user.name).toBe(newName);
});

test("list users unauthorized", async () => {
    const listUsersRes = await request(app).get("/api/user");
    expect(listUsersRes.status).toBe(401);
});


test('list users', async () => {
  const [, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get('/api/user')
    .set('Authorization', 'Bearer ' + userToken);
  expect(listUsersRes.status).toBe(200);
});

async function registerUser(service) {
    const testUser = {
        name: "pizza diner",
        email: `${randomName()}@test.com`,
        password: "a",
    };
    const registerRes = await service.post("/api/auth").send(testUser);
    registerRes.body.user.password = testUser.password;

    return [registerRes.body.user, registerRes.body.token];
}


