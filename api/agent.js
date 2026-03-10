// api/agent.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { prompt, conversation_id } = req.body;
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY,
    defaultHeaders: { "OpenAI-Beta": "conversations-2026-03-05" } 
  });

  try {
    let conversation;

    // FIX: Catch literal "null" or "undefined" strings from the browser
    const isValidId = conversation_id && 
                      conversation_id !== "null" && 
                      conversation_id !== "undefined" && 
                      conversation_id.trim() !== "";

    if (isValidId) {
      try {
        conversation = await openai.beta.conversations.retrieve(conversation_id);
      } catch (e) {
        // Fallback if the ID expired or is invalid
        conversation = await openai.beta.conversations.create({});
      }
    } else {
      conversation = await openai.beta.conversations.create({});
    }

    // Agent Execution
    const response = await openai.beta.responses.create({
      model: "gpt-4o", 
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
      toolUsed: response.usage_metadata?.tools_called?.[0]?.name || "GPT-5.4 Brain"
    });

  } catch (error) {
    console.error("Agent Error:", error.message);
    return res.status(200).json({ 
      output: `System Alert: ${error.message}. Ensure your OpenAI account has Tier 2 credits.`,
      conversation_id: null 
    });
  }
}
