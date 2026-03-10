// api/agent.js
const { OpenAI } = require('openai');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, conversation_id } = req.body;
  
  // Initialize with the 2026 project headers
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: { "OpenAI-Beta": "conversations-2026-01-01" } 
  });

  try {
    let conversation;
    
    // Check if we have a valid ID from the browser
    if (conversation_id && conversation_id !== "null" && conversation_id !== "undefined") {
      try {
        conversation = await openai.beta.conversations.retrieve(conversation_id);
      } catch (e) {
        // If ID is expired or invalid, create a fresh one
        conversation = await openai.beta.conversations.create();
      }
    } else {
      conversation = await openai.beta.conversations.create();
    }

    // Execute with GPT-5.4
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

    // GPT-5.4 uses 'choices' in the Responses API for streaming compatibility
    const outputText = response.choices[0].message.content;
    const toolUsed = response.usage_metadata?.tools_called?.[0] || "GPT-5.4 Memory";

    return res.status(200).json({
      output: outputText,
      conversation_id: conversation.id, 
      toolUsed: toolUsed
    });

  } catch (error) {
    console.error("Agent Crash:", error);
    return res.status(500).json({ 
      output: `System Error: ${error.message}. Please check if your OpenAI account has GPT-5.4 access.`,
      error_type: "SDK_Mismatch"
    });
  }
}
