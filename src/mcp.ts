import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import {
  chatWithOpenAI,
  streamChatWithOpenAI,
  type ChatMessage,
} from "./openai.js";

const OUT_DIR = "./out";

function listJobFiles(): string[] {
  if (!fs.existsSync(OUT_DIR)) return [];
  return fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) => b.localeCompare(a));
}

function readJobFile(filename: string): string {
  const filepath = path.join(OUT_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filename}`);
  }
  return fs.readFileSync(filepath, "utf8");
}

function parseJobMarkdown(content: string) {
  const lines = content.split("\n");
  const jobs: Array<{
    score: number;
    title: string;
    company: string;
    location: string;
    source: string;
    matched: string;
    url: string;
  }> = [];

  for (const line of lines) {
    if (
      line.startsWith("| ") &&
      line.includes("|") &&
      !line.startsWith("|---")
    ) {
      const parts = line
        .split("|")
        .map((p) => p.trim())
        .filter((p) => p);
      if (parts.length >= 6) {
        const titleMatch = parts[1].match(/\[([^\]]+)\]\(([^)]+)\)/);
        jobs.push({
          score: parseFloat(parts[0]),
          title: titleMatch ? titleMatch[1] : parts[1],
          url: titleMatch ? titleMatch[2] : "",
          company: parts[2],
          location: parts[3],
          source: parts[4],
          matched: parts[5],
        });
      }
    }
  }
  return jobs;
}

const server = new McpServer({
  name: "job-alert-digest",
  version: "1.0.0",
});

server.tool(
  "list-job-digests",
  "List all available job digest files in the out folder",
  {},
  async () => {
    const files = listJobFiles();
    return {
      content: [
        {
          type: "text",
          text: files.length ? files.join("\n") : "No job digests found",
        },
      ],
    };
  },
);

server.tool(
  "read-job-digest",
  "Read a specific job digest file by filename",
  {
    filename: z
      .string()
      .describe("Name of the job digest file (e.g., jobs-2026-11-16.md)"),
  },
  async ({ filename }) => {
    try {
      const content = readJobFile(filename);
      return { content: [{ type: "text", text: content }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.tool(
  "search-jobs",
  "Search for jobs across all digests matching a query",
  {
    query: z
      .string()
      .describe("Search query (matches title, company, location, skills)"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Maximum results to return"),
  },
  async ({ query, limit }) => {
    const files = listJobFiles();
    const queryLower = query.toLowerCase();
    const results: Array<{
      file: string;
      job: ReturnType<typeof parseJobMarkdown>[0];
    }> = [];

    for (const file of files) {
      const content = readJobFile(file);
      const jobs = parseJobMarkdown(content);
      for (const job of jobs) {
        const searchText =
          `${job.title} ${job.company} ${job.location} ${job.matched}`.toLowerCase();
        if (searchText.includes(queryLower)) {
          results.push({ file, job });
          if (results.length >= limit) break;
        }
      }
      if (results.length >= limit) break;
    }

    const formatted = results
      .map(
        ({ file, job }) =>
          `[${file}] ${job.title} at ${job.company} (${job.location}) - Score: ${job.score} - Skills: ${job.matched}`,
      )
      .join("\n");

    return {
      content: [{ type: "text", text: formatted || "No matching jobs found" }],
    };
  },
);

server.tool(
  "chat-with-jobs",
  "Chat with OpenAI about the job digests - provide context from job files and get AI response",
  {
    message: z.string().describe("Your question or prompt about the jobs"),
    model: z
      .string()
      .optional()
      .default("gpt-4o-mini")
      .describe("OpenAI model to use"),
    includeFiles: z
      .array(z.string())
      .optional()
      .describe("Specific digest files to include (defaults to latest)"),
  },
  async ({ message, model, includeFiles }) => {
    let context = "";
    const filesToUse = includeFiles?.length
      ? includeFiles
      : [listJobFiles()[0]].filter(Boolean);

    for (const file of filesToUse) {
      try {
        const content = readJobFile(file);
        context += `\n--- ${file} ---\n${content}\n`;
      } catch {
        // Skip missing files
      }
    }

    if (!context) {
      return {
        content: [
          {
            type: "text",
            text: "No job digests available to provide context.",
          },
        ],
      };
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a helpful assistant that answers questions about job listings. Use the provided job digest data to answer questions accurately.",
      },
      {
        role: "user",
        content: `Here are the current job digests:\n${context}\n\nUser question: ${message}`,
      },
    ];

    try {
      let fullResponse = "";
      await streamChatWithOpenAI(messages, model, (chunk) => {
        fullResponse += chunk;
      });
      return { content: [{ type: "text", text: fullResponse }] };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `OpenAI error: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.resource(
  "job-digest",
  new ResourceTemplate("job-digest://{filename}", { list: undefined }),
  async (uri, { filename }) => {
    try {
      const content = readJobFile(filename as string);
      return { contents: [{ uri: uri.href, text: content }] };
    } catch {
      return { contents: [] };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Job Alert Digest MCP server running on stdio");
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
