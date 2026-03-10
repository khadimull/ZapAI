// api/agent.js
const { OpenAI } = require('openai');

export default async function handler(req, res) {
  // CORS Headers for Blogger
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { prompt } = req.body;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Calling the OpenAI Responses API
    const response = await openai.responses.create({
      model: "gpt-4.1", // Ensure your account has access to this model
      input: prompt,
      tools: [{
        type: "mcp",
        server_label: "zapier",
        server_url: "https://mcp.zapier.com/api/v1/connect",
        require_approval: "never",
        headers: {
          "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}`
        }
      }]
    });

    return res.status(200).json({
      output: response.output_text,
      toolUsed: "Zapier MCP"
    });

  } catch (err) {
    // This sends the REAL error to your Blogger chat for debugging
    return res.status(200).json({ 
      output: `⚠️ ERROR: ${err.message}`,
      debug: err.stack 
    });
  }
}
