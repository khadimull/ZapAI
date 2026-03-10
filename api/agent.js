// api/agent.js
const { OpenAI } = require('openai');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, conversation_id } = req.body;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // 1. Memory Management: Reuse or create a persistent conversation
    let conversation;
    if (conversation_id) {
      conversation = await openai.conversations.retrieve(conversation_id);
    } else {
      conversation = await openai.conversations.create();
    }

    // 2. Execute with GPT-5.4 and Zapier MCP
    const response = await openai.responses.create({
      model: "gpt-5.4", // March 2026 Frontier Model
      conversation: conversation.id, // Links this run to persistent memory
      input: prompt,
      tools: [{
        type: "mcp",
        server_label: "zapier-suite",
        server_url: process.env.ZAPIER_MCP_URL,
        require_approval: "never",
        headers: { "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}` }
      }]
    });

    return res.status(200).json({
      output: response.output_text,
      conversation_id: conversation.id, // Send ID back to Blogger to store
      toolUsed: response.output.find(o => o.type === 'mcp_tool_call')?.name || "GPT-5.4 Memory"
    });

  } catch (error) {
    return res.status(500).json({ output: `Memory Error: ${error.message}` });
  }
}
