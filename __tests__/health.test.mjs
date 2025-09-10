import request from "supertest";

const base = process.env.TEST_BASE || "http://127.0.0.1:3000";

describe("health (server vivo)", () => {
  it("GET /api/health ok", async () => {
    const res = await request(base).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
