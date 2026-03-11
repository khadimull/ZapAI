// api/agent.js
import OpenAI from 'openai';

const conversationHistory = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, conversation_id } = req.body;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Build conversation history
    const isValidId = conversation_id &&
                      conversation_id !== "null" &&
                      conversation_id !== "undefined" &&
                      conversation_id.trim() !== "";

    const convId = isValidId ? conversation_id : `conv_${Date.now()}`;
    const messages = conversationHistory.get(convId) || [];

    messages.push({ role: "user", content: prompt });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful agent with access to Gmail, GitHub, and Google Sheets via Zapier MCP tools."
        },
        ...messages
      ],
      tools: [{
        type: "function",
        function: {
          name: "zapier_mcp",
          description: "Execute Zapier MCP actions for Gmail, GitHub, and Sheets",
          parameters: {
            type: "object",
            properties: {
              action: { type: "string", description: "The Zapier action to execute" },
              params: { type: "object", description: "Parameters for the action" }
            },
            required: ["action"]
          }
        }
      }]
    });

    const assistantMessage = response.choices[0].message;
    messages.push(assistantMessage);
    conversationHistory.set(convId, messages);

    const outputText = assistantMessage.content || 
      (assistantMessage.tool_calls ? "Executing Zapier action..." : "No response");
    const toolUsed = assistantMessage.tool_calls?.[0]?.function?.name || "GPT-4o Brain";

    return res.status(200).json({
      output: outputText,
      conversation_id: convId,
      toolUsed
    });

  } catch (error) {
    console.error("Agent Error:", error.message);
    return res.status(200).json({
      output: `System Alert: ${error.message}`,
      conversation_id: null
    });
  }
}
