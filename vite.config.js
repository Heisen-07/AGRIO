import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

/**
 * Dev middleware plugin: executes /api/* serverless handlers directly in Vite during local development.
 * Solves the proxy connection ECONNREFUSED 500 errors when no separate backend port is running.
 */
function apiDevPlugin() {
  return {
    name: 'agrio-api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const [urlPath, queryString] = req.url.split('?');
        const cleanPath = urlPath.replace(/^\//, ''); // e.g. "api/auth/register"
        const candidateFile = path.resolve(process.cwd(), `${cleanPath}.js`);

        if (!fs.existsSync(candidateFile)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `API route not found: ${req.url}` }));
          return;
        }

        try {
          // Parse URL search params into req.query
          req.query = Object.fromEntries(new URLSearchParams(queryString || ''));

          // Parse JSON body for mutation methods
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            try {
              req.body = rawBody ? JSON.parse(rawBody) : {};
            } catch {
              req.body = {};
            }
          }

          // Polyfill Vercel / Express helper methods
          res.status = function (code) {
            this.statusCode = code;
            return this;
          };
          res.json = function (data) {
            if (!this.headersSent) {
              this.setHeader('Content-Type', 'application/json');
            }
            this.end(JSON.stringify(data));
            return this;
          };

          // Dynamically load and execute serverless handler with Vite's SSR runtime
          const module = await server.ssrLoadModule(candidateFile);
          if (typeof module.default === 'function') {
            await module.default(req, res);
          } else {
            res.status(500).json({ error: 'Invalid API handler export' });
          }
        } catch (err) {
          console.error(`[api-dev] Error processing ${req.url}:`, err);
          if (!res.headersSent) {
            res.status(500).json({ error: err.message || 'Internal server error' });
          }
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load server-side env variables (MONGODB_URI, JWT_SECRET, etc.) from .env into process.env
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiDevPlugin()],

    optimizeDeps: {
      exclude: ['onnxruntime-web'],
    },

    assetsInclude: ['**/*.onnx'],
  };
});