import express from "express";
import path from "path";
import os from "os";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 5000;

  // API routes
  app.use(express.json({ limit: '50mb' }));

  const resolveUrl = (url: string) => url.replace('localhost', '127.0.0.1');

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Nexus AI Builder Backend is active." });
  });

  app.post("/api/proxy/ollama/tags", async (req, res) => {
    try {
      const response = await fetch(`${resolveUrl(req.body.url)}/api/tags`);
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/proxy/ollama/generate", async (req, res) => {
    try {
      const response = await fetch(`${resolveUrl(req.body.url)}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body.payload),
      });
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/proxy/ollama/chat", async (req, res) => {
    try {
      const response = await fetch(`${resolveUrl(req.body.url)}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body.payload),
      });
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n  🚀 Nexus AI Backend IS ACTIVE`);
    console.log(`  ➜  Local:   http://localhost:${PORT}`);
    
    // Dynamically fetch and log Network Interfaces
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      if (interfaces[name]) {
        for (const iface of interfaces[name]) {
          if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`  ➜  Network: http://${iface.address}:${PORT}`);
          }
        }
      }
    }
    console.log('');
  });
}

startServer();
