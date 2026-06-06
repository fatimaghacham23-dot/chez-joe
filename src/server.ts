import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getMenuData, setMenuData, DEFAULT_MENU } from "./lib/db";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { assistantTools } from "./lib/ai-tools";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);

    // API Route Interceptor for local and production
    if (url.pathname === "/api/menu") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }
      try {
        let menu = await getMenuData();
        if (!menu) {
          await setMenuData(DEFAULT_MENU);
          menu = DEFAULT_MENU;
        }
        return new Response(JSON.stringify(menu), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/api/menu/update") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }

      const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
      const adminPassword = process.env.ADMIN_PASSWORD;
      const passwordToCheck = adminPassword || "1234";

      if (!authHeader || (authHeader !== passwordToCheck && authHeader !== `Bearer ${passwordToCheck}`)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      try {
        const newMenu = await request.json();
        if (!Array.isArray(newMenu)) {
          return new Response(JSON.stringify({ error: "Invalid Menu Data format. Must be an array." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        await setMenuData(newMenu);
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/api/ai-transcribe") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }

      const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
      const adminPassword = process.env.ADMIN_PASSWORD;
      const passwordToCheck = adminPassword || "1234";

      if (!authHeader || (authHeader !== passwordToCheck && authHeader !== `Bearer ${passwordToCheck}`)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      try {
        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramKey) {
          return new Response(JSON.stringify({ error: "Deepgram API key is not configured in environment variables." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const arrayBuffer = await request.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        const deepgramRes = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true", {
          method: "POST",
          headers: {
            "Authorization": `Token ${deepgramKey}`,
            "Content-Type": request.headers.get("content-type") || "audio/webm",
          },
          body: audioBuffer,
        });

        if (!deepgramRes.ok) {
          const errMsg = await deepgramRes.text();
          throw new Error(`Deepgram STT API error: ${errMsg}`);
        }

        const data = await deepgramRes.json();
        const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || "";
        return new Response(JSON.stringify({ transcript }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/api/ai-assistant") {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }

      const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
      const adminPassword = process.env.ADMIN_PASSWORD;
      const passwordToCheck = adminPassword || "1234";

      if (!authHeader || (authHeader !== passwordToCheck && authHeader !== `Bearer ${passwordToCheck}`)) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "Groq API key is not configured in environment variables." }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { messages } = await request.json();
        const groq = createGroq({ apiKey });
        const modelName = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

        // Sanitize messages array to strip custom fields (like audio, addedItem)
        // that Groq's schema validator might reject.
        const sanitizedMessages = Array.isArray(messages)
          ? messages.map((m: any) => {
              const clean: any = {
                role: m.role,
                content: m.content || "",
              };
              if (m.name) clean.name = m.name;
              if (m.toolCalls) clean.toolCalls = m.toolCalls;
              if (m.toolResults) clean.toolResults = m.toolResults;
              return clean;
            })
          : [];

        console.log("--- Sending Request to Groq ---");
        console.log("Model:", modelName);
        console.log("Messages Payload:", JSON.stringify(sanitizedMessages, null, 2));

        let reloadMenu = false;
        let addedItem = null;

        const result = await generateText({
          model: groq(modelName),
          messages: sanitizedMessages,
          tools: assistantTools,
          system: `You are the Chez Joe AI Voice Admin Assistant. You manage the restaurant menu database.
Your responses should be extremely brief, concise, and spoken-friendly since they will be converted to speech.
You can understand English, French, and Lebanese-Arabic (written in Latin characters like Arabish/Franco-Arabic, e.g. "3adele", "se3er", "bade", "msa7").
For example:
- "3adele se3er l burger l 11 dollar" -> call updatePrice for Heritage Burger to 11.
- "zid hummus 8 dollar" -> call addItem for Hummus to 8.
- "m7e l garlick fries" -> call removeItem for Garlic Fries.

Safety Rules:
- Before executing addItem or removeItem, you MUST verbally repeat the action and ask for confirmation from the user (e.g., "I will remove Garlic Fries. Please say Yes to confirm.").
- Only set isConfirmed to true in the tool call if the user has explicitly confirmed the action in the conversation history (e.g. by saying "Yes", "Confirm", "Yalla", "Ok").
- If the user has not confirmed yet, do not call the tool, or call it with isConfirmed: false so that the tool execution tells you what confirmation message to say.

Image Workflow Rules:
- Immediately after you successfully execute the addItem tool, you MUST ask the user: "I have added the item. Would you like to upload an image for [Item Name]?"`,
          maxSteps: 5,
          onStepFinish({ toolCalls, toolResults }) {
            console.log("--- generateText Step Finished ---");
            console.log("Tool Calls:", JSON.stringify(toolCalls, null, 2));
            console.log("Tool Results (before sending back to Groq):", JSON.stringify(toolResults, null, 2));
            
            if (toolResults && toolResults.length > 0) {
              toolResults.forEach((r: any) => {
                if (r.result && r.result.success) {
                  if (r.toolName === "addItem" || r.toolName === "updatePrice" || r.toolName === "removeItem" || r.toolName === "updateItemImage") {
                    reloadMenu = true;
                  }
                  if (r.toolName === "addItem") {
                    addedItem = {
                      id: r.result.itemId || r.args.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
                      name: r.args.name,
                      price: r.args.price,
                      desc: r.args.description,
                      tag: r.args.category,
                      imageKey: 'plated'
                    };
                  }
                }
              });
            }
          }
        });

        const replyText = result.text || "I have processed your request.";

        // Attempt TTS conversion via Deepgram
        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramKey) {
          return new Response(JSON.stringify({
            text: replyText,
            audio: null,
            reloadMenu,
            addedItem,
            warning: "DEEPGRAM_API_KEY is not set. Using browser text-to-speech fallback."
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        const ttsRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
          method: "POST",
          headers: {
            "Authorization": `Token ${deepgramKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: replyText })
        });

        if (!ttsRes.ok) {
          console.warn("Deepgram TTS API failed, returning text only:", await ttsRes.text());
          return new Response(JSON.stringify({
            text: replyText,
            audio: null,
            reloadMenu,
            addedItem,
            warning: "Deepgram TTS API failed. Using browser text-to-speech fallback."
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        const audioBuffer = await ttsRes.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString("base64");
        const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;

        return new Response(JSON.stringify({
          text: replyText,
          audio: audioDataUrl,
          reloadMenu,
          addedItem
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err: any) {
        console.error("--- Error in generateText / ai-assistant Endpoint ---");
        console.error(err);
        if (err.responseBody) {
          console.error("Response Body:", err.responseBody);
        }
        if (err.data) {
          console.error("Error Data:", err.data);
        }
        return new Response(JSON.stringify({ 
          error: err.message || "Internal Server Error",
          details: err.responseBody || err.data || null 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
