// api/agent.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { messages } = req.body;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // 1. Prepend the System Persona to the memory array
    const conversationInput = [
      {
        role: "system", // Sets the boundaries for the Kibrille agent
        content: "You are a helpful assistant for the Kibrille brand with access to Gmail, GitHub, and Google Sheets via Zapier MCP tools."
      },
      ...messages
    ];

    // 2. Call the native Responses API with GPT-5.4
    const response = await openai.responses.create({
      model: "gpt-5.4", // Upgraded to the latest model
      input: conversationInput,
      tools: [
        {
          type: "mcp",
          server_label: "zapier_mcp",
          server_description: "Execute Zapier actions for Gmail, GitHub, and Sheets",
          // Make sure this URL matches your Zapier MCP SSE or Connect endpoint
          server_url: process.env.ZAPIER_MCP_URL || "https://mcp.zapier.com/api/v1/connect", 
          require_approval: "never",
          // Zapier requires your API key in the headers to authenticate the MCP connection
          headers: { 
            "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}` 
          }
        }
      ]
    });

    // 3. Extract the final orchestrated response
    const outputText = response.output_text || "Action completed, but no text was returned.";
    
    // Check if the Responses API logged an MCP tool execution
    const toolUsed = response.output?.find(item => item.type === 'mcp_tool_call')?.name || null;

    // 4. Create the new message object to send back to Blogger's local memory
    const assistantMessage = {
      role: "assistant",
      content: outputText
    };

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
