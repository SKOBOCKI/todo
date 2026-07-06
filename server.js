const http = require("http");
const fs = require("fs");
const path = require("path");

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const rootDir = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function createServerHandler(rootDirectory = rootDir) {
  return (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || HOST}`);
    let requestedPath = decodeURIComponent(requestUrl.pathname);

    if (requestedPath === "/") {
      requestedPath = "/index.html";
    }

    const safePath = path.normalize(requestedPath).replace(/^([.][/\\])+/g, "");
    const filePath = path.join(rootDirectory, safePath);
    const resolvedRoot = path.resolve(rootDirectory);
    const resolvedFilePath = path.resolve(filePath);

    if (
      !resolvedFilePath.startsWith(resolvedRoot + path.sep) &&
      resolvedFilePath !== resolvedRoot
    ) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    fs.stat(resolvedFilePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }

      const ext = path.extname(resolvedFilePath).toLowerCase();
      const contentType = mimeTypes[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      fs.createReadStream(resolvedFilePath).pipe(res);
    });
  };
}

function startServer(
  port = DEFAULT_PORT,
  host = HOST,
  rootDirectory = rootDir,
) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(createServerHandler(rootDirectory));

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE" && port < 65535) {
        startServer(port + 1, host, rootDirectory)
          .then(resolve)
          .catch(reject);
        return;
      }

      reject(error);
    });

    try {
      server.listen(port, host, () => {
        resolve({ server, port, host });
      });
    } catch (error) {
      if (error.code === "EADDRINUSE" && port < 65535) {
        startServer(port + 1, host, rootDirectory)
          .then(resolve)
          .catch(reject);
        return;
      }

      reject(error);
    }
  });
}

if (require.main === module) {
  startServer()
    .then(({ port, host }) => {
      console.log(`Aplicatia ruleaza la http://${host}:${port}`);
    })
    .catch((error) => {
      console.error("Nu s-a putut porni serverul:", error.message);
      process.exit(1);
    });
}

module.exports = { createServerHandler, startServer };
