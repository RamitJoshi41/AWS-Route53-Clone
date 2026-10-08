# Frontend: Route 53 Console Clone

Next.js 16 (App Router, TypeScript) + AWS Cloudscape Design System.

```bash
npm install
npm run dev     # http://localhost:3000 (expects the backend on :8000)
npm run lint
npm run build
```

`/api/*` is proxied to the FastAPI backend via `next.config.ts` (`BACKEND_URL`, default `http://localhost:8000`).

Full setup, architecture and API overview: see the [root README](../README.md).
