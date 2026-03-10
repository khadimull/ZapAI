// /api/agent.js — Claude claude-sonnet-4-20250514 with Zapier MCP + Conversation Memory
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory session store (use Redis/DB for production multi-user deployments)
const sessions = new Map();

const SYSTEM_PROMPT = `You are a helpful AI agent connected to Zapier tools for GitHub, Gmail, Google Sheets, and Google Docs.
You can execute real actions on behalf of the user. Always confirm what you've done clearly and concisely.
When using tools, explain which tool you're invoking and why before doing so.`;

export default async function handler(req, res) {
    // CORS for Blogger / external frontends
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { prompt, sessionId = "default" } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // ── Retrieve or initialise conversation history for this session ──
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, []);
    }
    const history = sessions.get(sessionId);

    // Append new user turn
    history.push({ role: "user", content: prompt });

    try {
        const response = await client.beta.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            messages: history,
            tools: [
                {
                    type: "mcp",
                    // Zapier MCP server — exposes GitHub, Gmail, Sheets, Docs, RSS actions
                    server_label: "zapier-tools",
                    server_url: process.env.ZAPIER_MCP_URL,
                    headers: {
                        Authorization: `Bearer ${process.env.ZAPIER_API_KEY}`,
                    },
                    require_approval: "never", // set "always" for sensitive write actions
                },
            ],
            betas: ["mcp-client-2025-04-04"],
        });

        // Extract the assistant reply text
        const assistantText = response.content
            .filter((block) => block.type === "text")
            .map((block) => block.text)
            .join("\n");

        // Identify which MCP tools were called
        const toolsUsed = response.content
            .filter((block) => block.type === "tool_use")
            .map((block) => block.name)
            .join(", ");

        // Persist assistant reply into conversation history
        history.push({ role: "assistant", content: response.content });

        // Keep session history bounded (last 40 turns = 20 exchanges)
        if (history.length > 40) {
            sessions.set(sessionId, history.slice(-40));
        }

        return res.status(200).json({
            output: assistantText,
            toolUsed: toolsUsed || "Claude Brain",
            sessionId,
            turns: history.length,
        });
    } catch (error) {
        console.error("Agent Error:", error);
        return res.status(500).json({
            output: "System Error: Could not reach the Claude API or MCP server. Check your environment variables.",
            error: error.message,
        });
    }
}
