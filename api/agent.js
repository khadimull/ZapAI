// /api/agent.js
const { OpenAI } = require('openai');

export default async function handler(req, res) {
    // 1. Setup CORS for Blogger
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { prompt } = req.body;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    try {
        /* 2. Execute using the Responses API with MCP Tools.
           The model GPT-5.4 is optimized for this direct protocol.
        */
        const response = await openai.responses.create({
            model: "gpt-5.4",
            tools: [
                {
                    type: "mcp",
                    server_label: "zapier-tools",
                    server_url: process.env.ZAPIER_MCP_URL, 
                    headers: {
                        "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}`
                    },
                    require_approval: "never" // Set to "always" for sensitive GitHub/Gmail actions
                }
            ],
            input: prompt
        });

        // 3. Extract the final text output and tool logs
        const outputText = response.output_text;
        const toolLogs = response.output.filter(item => item.type === 'mcp_tool_call')
                                       .map(tool => tool.name)
                                       .join(', ');

        return res.status(200).json({
            output: outputText,
            toolUsed: toolLogs || "AI Brain"
        });

    } catch (error) {
        console.error("Agent Error:", error);
        return res.status(500).json({ 
            output: "System Error: The agent could not reach the MCP server. Check your environment variables.",
            error: error.message 
        });
    }
}
