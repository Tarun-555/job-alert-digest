import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MCPClient } from "./src/mcp-client.js";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  console.log(">>> REQUEST:", req.method, req.path);
  next();
});

const mcpClient = new MCPClient({
  command: "npm",
  args: ["run", "mcp"],
  cwd: "/Users/tarun/Downloads/job-alert-digest",
  env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "" },
});

let isConnected = false;

async function ensureConnected() {
  if (!isConnected) {
    await mcpClient.connect();
    isConnected = true;
  }
}

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendChunk = (chunk: string) => {
    res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
  };

  const sendDone = () => {
    res.write(`data: [DONE]\n\n`);
    res.end();
  };

  const sendError = (error: string) => {
    res.write(`data: ${JSON.stringify({ error })}\n\n`);
    res.end();
  };

  try {
    await ensureConnected();
    const result = await mcpClient.chatWithJobs(message, "openrouter/free");

    // Simulate streaming by sending word-by-word
    const words = result.split(" ");
    for (let i = 0; i < words.length; i++) {
      sendChunk(words[i] + (i < words.length - 1 ? " " : ""));
      await new Promise((r) => setTimeout(r, 30));
    }
    sendDone();
  } catch (error) {
    console.error("Chat error:", error);
    sendError(error instanceof Error ? error.message : "Unknown error");
  }
});

app.get("/api/health", (req, res) => {
  console.log(">>> Health endpoint hit", req.path, req.method);
  res.json({ status: "ok", connected: isConnected });
});

app.get("/api/test", (req, res) => {
  console.log(">>> Test endpoint hit");
  res.json({ test: "ok" });
});

// Catch-all for SPA - must be LAST
app.use((req, res) => {
  console.log(">>> Catch-all hit:", req.path, req.method);
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", async () => {
  if (isConnected) await mcpClient.disconnect();
  process.exit(0);
});
