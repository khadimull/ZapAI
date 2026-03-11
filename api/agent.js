// api/agent.js
import OpenAI from 'openai';

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { messages } = req.body;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // 1. Generate the exact current time to keep the AI anchored in reality
    const localTime = new Date().toLocaleString("en-US", { timeZone: "Africa/Casablanca" });

    // 2. The Elite Personal Assistant Persona
    const conversationInput = [
      {
        role: "system", 
        content: `You are my proactive, elite personal executive assistant and second brain. The current date and local time is ${localTime}. 

        YOUR MISSION: To make my life easier, highly organized, and hyper-productive. I am an entrepreneur and team leader at ByteDance, based in Casablanca, juggling the launch of my car detailing brand (kibrille.ma), various AI/web development projects, and my personal life with a october 2025 born baby boy. 

        YOUR CORE BEHAVIORS:
        1. The Brain Dump Catcher: When I throw random thoughts, messy ideas, or rants at you, patiently organize them into clear memos, action items, or strategies. 
        2. Proactive Partner: Don't just answer questions and go silent. End your responses by asking me follow-up questions. Check in on me. Ask how my projects are going or if I need help outlining the next step.
        3. Tool Master: Autonomously use your Zapier MCP tools to log my notes into Google Sheets/Docs, draft or summarize Gmails, and push code to GitHub when asked, not only but also ask if I can provide any tool that may be useful. 
        4. Memory Builder: Actively try to get to know my preferences, work habits, and goals over time. 
        5. Your most important goal is to guide me building business that makes me earn 30K momthly on Upwork, fiverr, ecommerce, or detailing

        TONE: Conversational, sharp, highly organized, and empathetic. Speak to me like a trusted business partner and friend.
        
        CRITICAL INSTRUCTION: Never state that your knowledge is cut off in the past. If you need current info, use your tools or just talk to me normally.`
      },
      ...messages
    ];

    // 2. Call the native Responses API with GPT-5.4
    const response = await openai.responses.create({
      model: "gpt-5.4", // Upgraded to the latest model
      input: conversationInput,
      tools: [
        {
          type: "mcp",
          server_label: "zapier_mcp",
          server_description: "Execute Zapier actions for Gmail, GitHub, and Sheets",
          // Make sure this URL matches your Zapier MCP SSE or Connect endpoint
          server_url: process.env.ZAPIER_MCP_URL || "https://mcp.zapier.com/api/v1/connect", 
          require_approval: "never",
          // Zapier requires your API key in the headers to authenticate the MCP connection
          headers: { 
            "Authorization": `Bearer ${process.env.ZAPIER_API_KEY}` 
          }
        }
      ]
    });

    // 3. Extract the final orchestrated response
    const outputText = response.output_text || "Action completed, but no text was returned.";
    
    // Check if the Responses API logged an MCP tool execution
    const toolUsed = response.output?.find(item => item.type === 'mcp_tool_call')?.name || null;

    // 4. Create the new message object to send back to Blogger's local memory
    const assistantMessage = {
      role: "assistant",
      content: outputText
    };

    return res.status(200).json({
      output: outputText,
      newMessage: assistantMessage,
      toolUsed: toolUsed
    });

  } catch (error) {
    console.error("Agent Error:", error.message);
    return res.status(500).json({ output: `System Alert: ${error.message}` });
  }
}
