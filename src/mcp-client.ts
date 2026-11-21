import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import "dotenv/config";

interface MCPClientConfig {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport;
  private connected = false;

  constructor(config: MCPClientConfig) {
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: { ...process.env, ...config.env } as Record<string, string>,
    });

    this.client = new Client(
      { name: "job-alert-client", version: "1.0.0" },
      { capabilities: {} },
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.client.connect(this.transport);
    this.connected = true;
    console.log("Connected to MCP server");
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
    console.log("Disconnected from MCP server");
  }

  async listJobDigests(): Promise<string> {
    const result = await this.client.callTool({
      name: "list-job-digests",
      arguments: {},
    });
    return this.extractText(result);
  }

  async readJobDigest(filename: string): Promise<string> {
    const result = await this.client.callTool({
      name: "read-job-digest",
      arguments: { filename },
    });
    return this.extractText(result);
  }

  async searchJobs(query: string, limit = 20): Promise<string> {
    const result = await this.client.callTool({
      name: "search-jobs",
      arguments: { query, limit },
    });
    return this.extractText(result);
  }

  async chatWithJobs(
    message: string,
    model = "gpt-4o-mini",
    includeFiles?: string[],
  ): Promise<string> {
    const result = await this.client.callTool({
      name: "chat-with-jobs",
      arguments: { message, model, includeFiles },
    });
    return this.extractText(result);
  }

  private extractText(result: any): string {
    if (result.content && Array.isArray(result.content)) {
      return result.content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n");
    }
    return JSON.stringify(result, null, 2);
  }
}


