const request = require("supertest");
const app = require("../service");

// register a user to use for test, get user back with auth token
const startSession = async () => {
    let email = Math.random().toString(36).substring(2, 12) + "@test.com";
    let testUser = { name: "pizza diner", email: email, password: "a" };
    const registerRes = await request(app).post("/api/auth").send(testUser);
    testUser.token = registerRes.body.token;
    return testUser;
};

module.exports = { startSession };
