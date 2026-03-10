// api/agent.js
const OpenAI = require('openai');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, conversation_id } = req.body;
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    // This header is mandatory for GPT-5.4 memory features in 2026
    defaultHeaders: { "OpenAI-Beta": "conversations-2026-03-05" } 
  });

  try {
    // Check if the SDK actually loaded the beta module correctly
    if (!openai.beta || !openai.beta.conversations) {
      throw new Error("SDK Version Mismatch: Ensure package.json is set to ^5.4.0");
    }

    let conversation;
    if (conversation_id && conversation_id !== "null") {
      try {
        conversation = await openai.beta.conversations.retrieve(conversation_id);
      } catch (e) {
        conversation = await openai.beta.conversations.create({});
      }
    } else {
      conversation = await openai.beta.conversations.create({});
    }

    // Using the 2026 Responses API
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

    return res.status(200).json({
      output: response.choices[0].message.content,
      conversation_id: conversation.id, 
      toolUsed: response.usage_metadata?.tools_called?.[0]?.name || "GPT-5.4 Memory"
    });

  } catch (error) {
    console.error("Critical Agent Error:", error.message);
    return res.status(200).json({ 
      output: `System Alert: ${error.message}. Please redeploy Vercel without build cache.` 
    });
  }
}
