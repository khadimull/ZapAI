// api/agent.js
const { OpenAI } = require('openai');

export default async function handler(req, res) {
  // 1. Mandatory CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: "Use POST" });

  const { prompt } = req.body;
  
  // Initialize OpenAI
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
  });

  try {
    // 2. Call OpenAI Responses API with your specific Zapier MCP
    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: prompt || "Hello, list your capabilities.",
      tools: [
        {
          type: "mcp",
          server_label: "zapier",
          server_url: "https://mcp.zapier.com/api/v1/connect",
          require_approval: "never",
          headers: {
            "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}`
          }
        }
      ]
    });

    // 3. Robust Output Parsing
    const outputText = response.output_text || "Task completed, but no text was returned.";
    
    return res.status(200).json({
      output: outputText,
      toolUsed: "Zapier MCP"
    });

  } catch (error) {
    console.error("Function Crash:", error);
    return res.status(500).json({ 
      error: "Internal Error", 
      message: error.message,
      // Helps you debug in the Blogger console
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    });
  }
}
