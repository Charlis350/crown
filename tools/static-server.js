const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const port = Number(process.argv[2] || 4173);
const mime = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".unityweb": "application/octet-stream",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

http
  .createServer((request, response) => {
    let pathname = "/";
    try {
      pathname = decodeURIComponent(new URL(request.url, `http://127.0.0.1:${port}`).pathname);
    } catch {
      pathname = "/";
    }

    if (pathname === "/") pathname = "/index.html";

    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "cache-control": "no-store",
      "content-type": mime[path.extname(file).toLowerCase()] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Crown static server listening at http://127.0.0.1:${port}/`);
  });
