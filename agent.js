// /api/agent.js (Vercel Serverless Function)
const axios = require('axios');

export default async function handler(req, res) {
    // 1. Set CORS headers so your Blogger site can talk to this API
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { prompt } = req.body;

    try {
        // 2. Forward the request to Zapier Central / MCP
        // You need an API Key from your Zapier Central Dashboard
        const zapierResponse = await axios.post(
            'https://central.zapier.com/api/v1/assistant/YOUR_ASSISTANT_ID/chat', 
            {
                input: prompt,
                stream: false
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.ZAPIER_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // 3. Return the AI's response + metadata to Blogger
        return res.status(200).json({
            output: zapierResponse.data.output,
            toolUsed: zapierResponse.data.actions_taken || "General AI"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ output: "Agent connection failed. Check logs." });
    }
}
