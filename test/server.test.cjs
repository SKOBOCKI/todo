const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("net");
const { startServer } = require("../server.js");

test("starts on the next available port when requested port is busy", async () => {
  const blocker = net.createServer();
  await new Promise((resolve) => blocker.listen(3100, "127.0.0.1", resolve));

  try {
    const { server, port } = await startServer(3100, "127.0.0.1");
    assert.equal(port, 3101);

    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  } finally {
    await new Promise((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
