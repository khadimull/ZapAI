// /api/agent.js — Claude claude-sonnet-4-20250514 · Smart tool injection · Client-side history
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Keywords that signal the user wants a real Zapier integration action
const ZAPIER_TRIGGERS = [
    "gmail", "email", "inbox", "send mail", "draft",
    "github", "repo", "issue", "pull request", "commit", "branch",
    "sheets", "spreadsheet", "rows", "google doc", "gdoc",
    "zapier", "automate", "trigger", "zap",
    "calendar", "event", "schedule",
    "slack", "message", "notify",
];

function needsZapierTools(prompt) {
    const lower = prompt.toLowerCase();
    return ZAPIER_TRIGGERS.some((kw) => lower.includes(kw));
}

const SYSTEM_PROMPT = `You are Claude, an AI assistant made by Anthropic (claude-sonnet-4-20250514).

KEY RULES:
- Answer ALL general questions — greetings, facts, memory, math, identity — using your own knowledge directly. Never say you lack information when it's in the conversation history.
- You have perfect memory of the current conversation. The complete history is always provided to you. Reference it accurately.
- If you are given Zapier tools, use them ONLY for explicit integration requests: sending emails, reading Gmail, managing GitHub repos/issues, reading/writing Google Sheets or Docs.
- Be concise and friendly.`;

export default async function handler(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { prompt, history = [] } = req.body;
    if (!prompt) return res.status(400).json({ error: "Missing prompt" });

    // Build messages: full client history + new user turn
    const messages = [
        ...history,
        { role: "user", content: prompt },
    ].slice(-40); // cap at 40 turns

    // ── Only give Claude Zapier tools when the prompt actually needs them ──
    // This prevents the "AI Brain" GPT tool from being called for normal chat
    const useZapier = needsZapierTools(prompt);

    const requestBody = {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
    };

    if (useZapier && process.env.ZAPIER_MCP_URL) {
        requestBody.tools = [
            {
                type: "mcp",
                server_label: "zapier-tools",
                server_url: process.env.ZAPIER_MCP_URL,
                headers: { Authorization: `Bearer ${process.env.ZAPIER_API_KEY}` },
                require_approval: "never",
            },
        ];
        requestBody.betas = ["mcp-client-2025-04-04"];
    }

    try {
        const response = await client.beta.messages.create(requestBody);

        const assistantText = response.content
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("\n");

        const toolsUsed = response.content
            .filter((b) => b.type === "tool_use")
            .map((b) => b.name)
            .join(", ");

        // Return updated history for client to store
        const updatedHistory = [
            ...messages,
            { role: "assistant", content: assistantText },
        ];

        return res.status(200).json({
            output: assistantText,
            toolUsed: toolsUsed || null,          // null = Claude answered directly
            zapierUsed: useZapier && !!toolsUsed,
            history: updatedHistory,
            turns: Math.ceil(updatedHistory.length / 2),
        });

    } catch (error) {
        console.error("Agent Error:", error);
        return res.status(500).json({
            output: "System Error: Could not reach the Claude API. Check your environment variables.",
            error: error.message,
        });
    }
}
