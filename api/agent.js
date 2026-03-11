// api/agent.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { messages } = req.body;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant for the Kibrille brand with access to Gmail, GitHub, and Google Sheets via Zapier MCP tools."
        },
        ...messages
      ],
      tools: [{
        type: "function",
        function: {
          name: "zapier_mcp",
          description: "Execute Zapier actions for Gmail, GitHub, and Sheets",
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
    
    // Check if the AI decided to use a tool
    const toolUsed = assistantMessage.tool_calls?.[0]?.function?.name || null;
    const outputText = assistantMessage.content || (toolUsed ? "Preparing Zapier action..." : "No response");

    return res.status(200).json({
      output: outputText,
      newMessage: assistantMessage,
      toolUsed: toolUsed
    });

  } catch (error) {
    console.error("Agent Error:", error.message);
    return res.status(500).json({ output: `System Alert: ${error.message}` });
  }
}
