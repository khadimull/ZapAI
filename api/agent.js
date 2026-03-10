// /api/agent.js — Claude claude-sonnet-4-20250514 · Client-side history · Stateless serverless-safe
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Claude, an AI assistant made by Anthropic, running as part of a Zapier MCP integration.

CRITICAL RULES — read carefully:
1. ALWAYS answer general questions (greetings, facts, identity, math, advice) yourself using your own knowledge. NEVER delegate these to any tool.
2. You are Claude Sonnet 4. If asked who you are, say so confidently.
3. ONLY call Zapier MCP tools when the user explicitly requests a real integration action:
   - Sending or reading Gmail emails
   - Creating or reading GitHub issues/repos
   - Reading or writing Google Sheets/Docs rows
   - Any other explicit Zapier automation
4. You have perfect memory of this conversation — the full history is sent to you on every turn. Use it accurately.
5. Be concise, friendly, and helpful.`;

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    // Client sends the full conversation history every request — no server-side state needed
    // history format: [{ role: "user"|"assistant", content: "string" }, ...]
    const { prompt, history = [] } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // Append the new user message to the history received from the client
    const messages = [...history, { role: "user", content: prompt }];

    // Clamp to last 40 turns to stay within token limits
    const clampedMessages = messages.slice(-40);

    try {
        const response = await client.beta.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: clampedMessages,
            tools: [
                {
                    type: "mcp",
                    server_label: "zapier-tools",
                    server_url: process.env.ZAPIER_MCP_URL,
                    headers: {
                        Authorization: `Bearer ${process.env.ZAPIER_API_KEY}`,
                    },
                    require_approval: "never",
                },
            ],
            betas: ["mcp-client-2025-04-04"],
        });

        // Extract text reply from Claude
        const assistantText = response.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");

        // Identify Zapier MCP tools actually invoked
        const toolsUsed = response.content
            .filter((b) => b.type === "tool_use")
            .map((b) => b.name)
            .join(", ");

        // Build the updated history to return to the client for the next turn
        // Serialize assistant content to plain string so client can store it simply
        const updatedHistory = [
            ...clampedMessages,
            { role: "assistant", content: assistantText },
        ];

        return res.status(200).json({
            output: assistantText,
            toolUsed: toolsUsed || "Claude",   // "Claude" = answered from own knowledge
            history: updatedHistory,            // client stores this and sends it next turn
            turns: Math.ceil(updatedHistory.length / 2),
        });

    } catch (error) {
        console.error("Agent Error:", error);
        return res.status(500).json({
            output: "System Error: Could not reach the Claude API or MCP server. Check your environment variables.",
            error: error.message,
        });
    }
}
