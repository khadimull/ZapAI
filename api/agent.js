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
    // 1. Memory: Retrieve existing conversation or initiate a new one
    let conversation;
    if (conversation_id && conversation_id !== "null") {
      conversation = await openai.conversations.retrieve(conversation_id);
    } else {
      conversation = await openai.conversations.create();
    }

    // 2. Execution: Using GPT-5.4 with the Responses API
    const response = await openai.responses.create({
      model: "gpt-5.4", // The March 2026 Flagship Model
      conversation: conversation.id,
      input: prompt,
      // GPT-5.4 specific: Automatically manages tool search for large toolsets
      tools: [{
        type: "mcp",
        server_label: "zapier-suite",
        server_url: "https://mcp.zapier.com/api/v1/connect",
        require_approval: "never", 
        headers: { "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}` }
      }]
    });

    // 3. Extract output and identify which tool GPT-5.4 chose
    const toolUsed = response.output.find(o => o.type === 'mcp_tool_call')?.name || "GPT-5.4 Memory";

    return res.status(200).json({
      output: response.output_text,
      conversation_id: conversation.id, 
      toolUsed: toolUsed
    });

  } catch (error) {
    console.error("Conversation Error:", error);
    return res.status(500).json({ 
      output: `System error: ${error.message}`,
      error_type: "MemoryFailure"
    });
  }
}
