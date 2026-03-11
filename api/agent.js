// api/agent.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, conversation_id } = req.body;

  // 1. Initialize with the 2026 Beta Headers required for GPT-5.4
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: { "OpenAI-Beta": "conversations-2026-03-05" } 
  });

  try {
    let conversation;

    // 2. Validate ID from Blogger
    const isValidId = conversation_id && 
                      conversation_id !== "null" && 
                      conversation_id !== "undefined" && 
                      conversation_id.trim() !== "";

    // 3. Durable Memory: Retrieve or Create thread on OpenAI's servers
    if (isValidId) {
      try {
        conversation = await openai.beta.conversations.retrieve(conversation_id);
      } catch (e) {
        conversation = await openai.beta.conversations.create({});
      }
    } else {
      conversation = await openai.beta.conversations.create({});
    }

    // 4. Execute GPT-5.4 with native MCP Tooling
    const response = await openai.beta.responses.create({
      model: "gpt-5.4",
      conversation_id: conversation.id,
      input: [{ role: "user", content: prompt }],
      tools: [{
        type: "mcp",
        server_label: "zapier-suite",
        server_url: "https://mcp.zapier.com/api/v1/connect",
        require_approval: "never",
        headers: { "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}` }
      }]
    });

    // 5. Parse the 2026 response structure
    const outputText = response.choices[0].message.content;
    const toolUsed = response.usage_metadata?.tools_called?.[0]?.name || "GPT-5.4 Brain";

    return res.status(200).json({
      output: outputText,
      conversation_id: conversation.id,
      toolUsed: toolUsed
    });

  } catch (error) {
    console.error("Agent Error:", error.message);
    return res.status(200).json({
      output: `System Alert: ${error.message}`,
      conversation_id: null
    });
  }
}
