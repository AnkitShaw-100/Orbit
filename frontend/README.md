# Orbit — frontend

React 19 + Vite client for Orbit. See the [root README](../README.md) for architecture, setup, and
the API reference.

```bash
npm install
cp .env.example .env   # VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:5173
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

Stack: React Router, Tailwind CSS v4, shadcn/ui, TanStack Query, Framer Motion, TradingView
Lightweight Charts, Supabase Auth.
