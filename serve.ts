// Tiny static server for previewing midicss.html (the file itself needs no
// server — this exists only for browser-preview tooling).
export {};

Bun.serve({
  port: 8642,
  fetch(req: Request): Response {
    const path = new URL(req.url).pathname;
    const file = path === "/" ? "midicss.html" : "." + path;
    return new Response(Bun.file(file));
  },
});

console.log("serving on http://localhost:8642");
