// api/agent.js
const OpenAI = require('openai'); // Use standard require

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, conversation_id } = req.body;
  
  // Initialize OpenAI with the required Beta header for 2026 features
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: { "OpenAI-Beta": "conversations-2026-03-05" }
  });

  try {
    let conversation;
    
    // Fix: Accessing conversations through the beta namespace correctly
    if (conversation_id && conversation_id !== "null") {
      try {
        conversation = await openai.beta.conversations.retrieve(conversation_id);
      } catch (e) {
        conversation = await openai.beta.conversations.create({});
      }
    } else {
      conversation = await openai.beta.conversations.create({});
    }

    // Fix: In v5.4.0, 'responses' is also under beta
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

    // GPT-5.4 Response object structure
    const outputText = response.choices[0].message.content;
    const toolUsed = response.usage_metadata?.tools_called?.[0]?.name || "GPT-5.4 Memory";

    return res.status(200).json({
      output: outputText,
      conversation_id: conversation.id, 
      toolUsed: toolUsed
    });

  } catch (error) {
    console.error("Middleware Error:", error);
    // Returning 200 with error text helps prevent the Blogger UI from completely breaking
    return res.status(200).json({ 
      output: `Agent Logic Error: ${error.message}. Please check your Vercel logs.`,
      conversation_id: conversation_id 
    });
  }
}
