import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { evaluateGuardRequest } from "@/lib/guard/engine";
import type { GuardRequest } from "@/lib/guard/types";
import { runAllowlistedDatabaseQuery, searchGitHubIssues, sendSlackMessage } from "@/lib/mcp/executors";

type RegisteredTool = {
  server: string;
  name: string;
  risk: "read" | "write" | "destructive";
};

function guardRequest(tool: RegisteredTool, arguments_: Record<string, unknown>, environment: GuardRequest["environment"]): GuardRequest {
  return {
    requestId: `req_${randomUUID()}`,
    sessionId: `mcp_${randomUUID()}`,
    timestamp: new Date().toISOString(),
    principal: { agentId: "remote-mcp-client", runtime: "openai-agents", roles: ["mcp-client"] },
    tool,
    arguments: arguments_,
    environment,
    provenance: { source: "user", trusted: true, summary: "Remote MCP Streamable HTTP request" },
  };
}

async function executeProtectedTool(
  tool: RegisteredTool,
  arguments_: Record<string, unknown>,
  environment: GuardRequest["environment"] = "development",
  executor?: (safeArguments: Record<string, unknown>) => Promise<unknown>,
) {
  const decision = evaluateGuardRequest(guardRequest(tool, arguments_, environment));

  if (decision.verdict === "block") {
    return {
      isError: true,
      content: [{ type: "text" as const, text: `AgentGuard blocked this call: ${decision.explanation}` }],
      structuredContent: { agentguard: decision },
    };
  }

  if (decision.verdict === "approval") {
    return {
      content: [
        {
          type: "text" as const,
          text: `PENDING_APPROVAL ${decision.approvalRequestId}: the tool has not executed.`,
        },
      ],
      structuredContent: { agentguard: decision, executed: false },
    };
  }

  const safeArguments = decision.sanitizedArguments;
  const result = executor
    ? await executor(safeArguments)
    : { provider: "agentguard", simulated: true, data: { accepted: true } };
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ ok: true, tool: tool.name, arguments: safeArguments, result }),
      },
    ],
    structuredContent: { agentguard: decision, executed: true, result },
  };
}

export function createAgentGuardMcpServer() {
  const server = new McpServer({ name: "agentguard-security-gateway", version: "0.1.0" });

  server.registerTool(
    "github_search_issues",
    {
      title: "Search GitHub issues",
      description: "Searches issues in the configured repository through an AgentGuard read policy.",
      inputSchema: { query: z.string(), limit: z.number().int().min(1).max(20).default(5) },
    },
    async (arguments_) =>
      executeProtectedTool(
        { server: "engineering", name: "github.search_issues", risk: "read" },
        arguments_,
        "development",
        searchGitHubIssues,
      ),
  );

  server.registerTool(
    "slack_send_message",
    {
      title: "Send Slack message",
      description: "Sends a message only after AgentGuard scans and sanitizes outbound content.",
      inputSchema: { channel: z.string(), message: z.string().max(4000) },
    },
    async (arguments_) =>
      executeProtectedTool(
        { server: "communications", name: "slack.send_message", risk: "write" },
        arguments_,
        "staging",
        sendSlackMessage,
      ),
  );

  server.registerTool(
    "database_query",
    {
      title: "Read database",
      description: "Runs an allowlisted read query through the guarded database adapter.",
      inputSchema: { queryName: z.enum(["recent_incidents", "policy_metrics", "audit_summary"]) },
    },
    async (arguments_) =>
      executeProtectedTool(
        { server: "operations", name: "database.query", risk: "read" },
        arguments_,
        "development",
        runAllowlistedDatabaseQuery,
      ),
  );

  server.registerTool(
    "database_execute",
    {
      title: "Execute database operation",
      description: "Demonstration-only administrative database tool protected by default-deny policies.",
      inputSchema: { sql: z.string().max(2000), reason: z.string().max(500) },
    },
    async (arguments_) =>
      executeProtectedTool(
        { server: "operations", name: "database.execute", risk: "destructive" },
        arguments_,
        "production",
      ),
  );

  server.registerTool(
    "deployment_rollback",
    {
      title: "Rollback deployment",
      description: "Creates a production rollback request that always pauses for human approval.",
      inputSchema: { service: z.string(), fromVersion: z.string(), toVersion: z.string() },
    },
    async (arguments_) =>
      executeProtectedTool(
        { server: "deployments", name: "deployment.rollback", risk: "destructive" },
        arguments_,
        "production",
      ),
  );

  server.registerTool(
    "billing_issue_refund",
    {
      title: "Issue refund",
      description: "Issues a refund subject to role, amount, and approval policies.",
      inputSchema: { customerId: z.string(), amount: z.number().positive(), reason: z.string() },
    },
    async (arguments_) =>
      executeProtectedTool(
        { server: "billing", name: "billing.issue_refund", risk: "write" },
        arguments_,
        "production",
      ),
  );

  return server;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport();
  const server = createAgentGuardMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}
