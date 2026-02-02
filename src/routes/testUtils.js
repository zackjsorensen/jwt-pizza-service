const request = require("supertest");
const app = require("../service");

const login = async () => {
    const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
    let testUserAuthToken;
    const loginRes = await request(app).put("/api/auth").send(testUser);
    return loginRes.body.token;
};


module.exports = { login };