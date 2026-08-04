import { Agent, MCPServerStreamableHttp, run } from "@openai/agents";

export async function runOpenAIAgent(prompt: string, appUrl: string) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

  const mcpServer = new MCPServerStreamableHttp({
    url: `${appUrl.replace(/\/$/, "")}/api/mcp`,
    name: "AgentGuard protected tools",
    cacheToolsList: true,
  });

  await mcpServer.connect();
  try {
    const agent = new Agent({
      name: "AgentGuard OpenAI security analyst",
      model: process.env.OPENAI_DEFAULT_MODEL ?? "gpt-5.6",
      instructions:
        "Investigate the request using only the protected MCP tools. Respect blocked and pending-approval results. Never claim a tool executed unless its result says executed=true.",
      mcpServers: [mcpServer],
      mcpConfig: { convertSchemasToStrict: true, includeServerInToolNames: true },
    });
    const result = await run(agent, prompt, { maxTurns: 8 });
    return { runtime: "openai-agents" as const, output: String(result.finalOutput ?? ""), live: true };
  } finally {
    await mcpServer.close();
  }
}
