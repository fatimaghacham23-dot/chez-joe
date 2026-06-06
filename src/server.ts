import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getMenuData, setMenuData, DEFAULT_MENU } from "./lib/db";
import {
  assistantTools,
  createMenuEvent,
  createMenuItemId,
  executeMenuTool,
  findMenuItem,
  isMenuMutationTool,
  normalizePrice,
  REALTIME_VOICE_SYSTEM_PROMPT,
  realtimeToolDefinitions,
  toMenuRecord,
  type MenuEventPayload,
  type MenuRecord,
  type MenuToolName,
} from "./lib/ai-tools";
import { generateText, stepCountIs, tool } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";

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

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function isAuthorizedAdmin(request: Request) {
  const authHeader = request.headers.get("Authorization") || request.headers.get("authorization");
  const adminPassword = process.env.ADMIN_PASSWORD;
  const passwordToCheck = adminPassword || "1234";

  return Boolean(
    authHeader && (authHeader === passwordToCheck || authHeader === `Bearer ${passwordToCheck}`),
  );
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: jsonHeaders,
  });
}

function methodNotAllowedResponse() {
  return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
}

function optionsResponse(allowedMethods = "POST, OPTIONS") {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": allowedMethods,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
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

      const authHeader =
        request.headers.get("Authorization") || request.headers.get("authorization");
      const adminPassword = process.env.ADMIN_PASSWORD;
      const passwordToCheck = adminPassword || "1234";

      if (
        !authHeader ||
        (authHeader !== passwordToCheck && authHeader !== `Bearer ${passwordToCheck}`)
      ) {
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
          return new Response(
            JSON.stringify({ error: "Invalid Menu Data format. Must be an array." }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
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

    if (url.pathname === "/api/ai-tool") {
      if (request.method === "OPTIONS") {
        return optionsResponse();
      }
      if (request.method !== "POST") {
        return methodNotAllowedResponse();
      }

      if (!isAuthorizedAdmin(request)) {
        return unauthorizedResponse();
      }

      try {
        const { toolName, args = {} } = await request.json();
        const result = await executeMenuTool(toolName as MenuToolName, args);
        const menuEvent = createMenuEvent(toolName, args, result);

        return new Response(
          JSON.stringify({
            success: Boolean(result.success),
            toolName,
            result,
            reloadMenu: Boolean(menuEvent),
            menuEvent,
          }),
          {
            status: result.success === false ? 400 : 200,
            headers: jsonHeaders,
          },
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }

    if (url.pathname === "/api/realtime-session") {
      if (request.method === "OPTIONS") {
        return optionsResponse();
      }
      if (request.method !== "POST") {
        return methodNotAllowedResponse();
      }

      if (!isAuthorizedAdmin(request)) {
        return unauthorizedResponse();
      }

      try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "OPENAI_API_KEY is not configured in environment variables." }),
            {
              status: 400,
              headers: jsonHeaders,
            },
          );
        }

        const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2";
        const voice = process.env.OPENAI_REALTIME_VOICE || "marin";
        const sessionConfig = {
          session: {
            type: "realtime",
            model,
            instructions: `${REALTIME_VOICE_SYSTEM_PROMPT}

Decision rules:
- Use getMenu before answering menu availability, price, description, or sold-out questions.
- Use editItem for direct menu edits such as price, name, or description changes.
- Use updateItemImage for item photos when an image URL or base64 image is provided.
- After a successful tool call, briefly state the completed action.`,
            audio: {
              output: {
                voice,
              },
            },
            tools: realtimeToolDefinitions,
            tool_choice: "auto",
          },
        };

        const realtimeRes = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sessionConfig),
        });

        const data = await realtimeRes.json().catch(async () => ({
          error: await realtimeRes.text(),
        }));

        if (!realtimeRes.ok) {
          return new Response(
            JSON.stringify({
              error: "Failed to create OpenAI Realtime client secret.",
              details: data,
            }),
            {
              status: realtimeRes.status,
              headers: jsonHeaders,
            },
          );
        }

        return new Response(
          JSON.stringify({
            ...data,
            model,
            voice,
            instructions: sessionConfig.session.instructions,
            toolDefinitions: realtimeToolDefinitions,
          }),
          {
            status: 200,
            headers: jsonHeaders,
          },
        );
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
          status: 500,
          headers: jsonHeaders,
        });
      }
    }

    if (url.pathname === "/api/deepgram-token") {
      if (request.method === "OPTIONS") {
        return optionsResponse();
      }
      if (request.method !== "POST") {
        return methodNotAllowedResponse();
      }

      if (!isAuthorizedAdmin(request)) {
        return unauthorizedResponse();
      }

      try {
        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramKey) {
          return new Response(
            JSON.stringify({
              error: "DEEPGRAM_API_KEY is not configured in environment variables.",
            }),
            {
              status: 400,
              headers: jsonHeaders,
            },
          );
        }

        const tokenRes = await fetch("https://api.deepgram.com/v1/auth/grant", {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
          },
        });
        const data = await tokenRes.json().catch(async () => ({ error: await tokenRes.text() }));

        if (!tokenRes.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to create Deepgram temporary token.", details: data }),
            {
              status: tokenRes.status,
              headers: jsonHeaders,
            },
          );
        }

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: jsonHeaders,
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
          status: 500,
          headers: jsonHeaders,
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

      const authHeader =
        request.headers.get("Authorization") || request.headers.get("authorization");
      const adminPassword = process.env.ADMIN_PASSWORD;
      const passwordToCheck = adminPassword || "1234";

      if (
        !authHeader ||
        (authHeader !== passwordToCheck && authHeader !== `Bearer ${passwordToCheck}`)
      ) {
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
          return new Response(
            JSON.stringify({
              error: "Deepgram API key is not configured in environment variables.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const arrayBuffer = await request.arrayBuffer();
        const audioBuffer = Buffer.from(arrayBuffer);

        const deepgramRes = await fetch(
          "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&detect_language=true",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${deepgramKey}`,
              "Content-Type": request.headers.get("content-type") || "audio/webm",
            },
            body: audioBuffer,
          },
        );

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

      const authHeader =
        request.headers.get("Authorization") || request.headers.get("authorization");
      const adminPassword = process.env.ADMIN_PASSWORD;
      const passwordToCheck = adminPassword || "1234";

      if (
        !authHeader ||
        (authHeader !== passwordToCheck && authHeader !== `Bearer ${passwordToCheck}`)
      ) {
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
          return new Response(
            JSON.stringify({ error: "Groq API key is not configured in environment variables." }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          );
        }

        const { messages } = await request.json();
        const groq = createGroq({ apiKey });
        const modelName = "llama-3.3-70b-versatile";

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

        const assistantState: {
          reloadMenu: boolean;
          addedItem: MenuRecord | null;
          menuEvent: MenuEventPayload | null;
        } = {
          reloadMenu: false,
          addedItem: null,
          menuEvent: null,
        };

        const result = await generateText({
          model: groq("llama-3.3-70b-versatile"),
          messages: sanitizedMessages,
          tools: {
            getMenu: tool({
              description: "Retrieve the current list of menu items with their details.",
              inputSchema: z.object({}),
              execute: async () => {
                const menu = await getMenuData();
                return { success: true, menu };
              },
            }),
            updateItemPrice: tool({
              description: "Update the price of an existing menu item.",
              inputSchema: z.object({
                itemName: z
                  .string()
                  .describe("The name of the menu item (e.g. burger, tawook, halloumi)"),
                newPrice: z.union([z.string(), z.number()]).describe("The new price in USD"),
                isConfirmed: z
                  .boolean()
                  .describe(
                    "Set to true only if the user explicitly confirmed the price change in the last turn.",
                  ),
              }),
              execute: async ({ itemName, newPrice, isConfirmed }) => {
                const menu = (await getMenuData()) || [];
                const item = findMenuItem(menu, itemName);
                const numericPrice = normalizePrice(newPrice);

                if (!item) {
                  return {
                    success: false,
                    error: `Menu item matching "${itemName}" was not found.`,
                  };
                }

                if (!isConfirmed) {
                  return {
                    success: false,
                    requiresConfirmation: true,
                    itemId: item.id,
                    itemName: item.name,
                    newPrice: numericPrice,
                    message: `Are you sure you want to update ${item.name} to $${numericPrice.toFixed(2)}?`,
                  };
                }

                item.price = numericPrice;
                await setMenuData(menu);
                return {
                  success: true,
                  itemId: item.id,
                  itemName: item.name,
                  newPrice: numericPrice,
                  item: toMenuRecord(item),
                  message: `Updated the price of ${item.name} to $${numericPrice.toFixed(2)}.`,
                };
              },
            }),
            editItem: assistantTools.editItem,
            // Explicitly define the tool with the schema inside the generateText call.
            addItem: {
              description: "Add a new item to the menu",
              inputSchema: z.object({
                name: z.string(),
                price: z.union([z.string(), z.number()]),
                isConfirmed: z.boolean(),
                description: z.string().optional(),
                category: z.string().optional(),
              }),
              execute: async ({
                name,
                price,
                isConfirmed,
                description,
                category,
              }: {
                name: string;
                price: string | number;
                isConfirmed: boolean;
                description?: string;
                category?: string;
              }) => {
                const numericPrice = normalizePrice(price);
                if (!isConfirmed) {
                  return {
                    success: false,
                    requiresConfirmation: true,
                    message: `Please confirm that you want to add ${name} for $${numericPrice.toFixed(2)}.`,
                  };
                }

                try {
                  const menu = (await getMenuData()) || [];
                  const id = createMenuItemId(name);

                  if (menu.some((m: any) => m.id === id)) {
                    return { success: false, error: `An item with id "${id}" already exists.` };
                  }

                  const newItem = {
                    id,
                    name,
                    desc: description || "",
                    price: numericPrice,
                    tag: category || "Signature",
                    imageKey: "plated", // Default fallback image key
                    isSoldOut: false,
                  };

                  menu.push(newItem);
                  await setMenuData(menu);
                  return {
                    success: true,
                    itemId: id,
                    itemName: name,
                    item: toMenuRecord(newItem),
                    message: `Successfully added "${name}" to the menu.`,
                  };
                } catch (err: any) {
                  return { success: false, error: `Database write failed: ${err.message}` };
                }
              },
            },
            updateItemImage: tool({
              description:
                "Update the image of an existing menu item using a preset key, a base64 image data URL, or an http/https image URL.",
              inputSchema: z.object({
                itemId: z.string().describe("The ID or name of the menu item (e.g. garlic_fries)"),
                imageKey: z
                  .string()
                  .optional()
                  .describe("The preset image key, image URL, or base64 data URL"),
                imageUrl: z.string().optional().describe("An http or https image URL"),
                base64Image: z.string().optional().describe("A base64 data URL"),
              }),
              execute: async ({ itemId, imageKey, imageUrl, base64Image }) => {
                try {
                  const menu = (await getMenuData()) || [];
                  const item = findMenuItem(menu, itemId);
                  const nextImageKey = imageKey || imageUrl || base64Image;

                  if (!item) {
                    return {
                      success: false,
                      error: `Menu item with ID or name "${itemId}" was not found.`,
                    };
                  }

                  if (!nextImageKey) {
                    return {
                      success: false,
                      error: "Image source must be a preset key, an image URL, or a base64 data URL.",
                    };
                  }

                  item.imageKey = nextImageKey;
                  await setMenuData(menu);
                  return {
                    success: true,
                    itemId: item.id,
                    itemName: item.name,
                    imageKey: nextImageKey,
                    item: toMenuRecord(item),
                    message: `Successfully updated the image for "${item.name}".`,
                  };
                } catch (err: any) {
                  return { success: false, error: `Database write failed: ${err.message}` };
                }
              },
            }),
            removeItem: tool({
              description:
                "Remove a menu item from the restaurant database. Safety reminder: verbally ask the user to confirm with Yes before calling this tool with isConfirmed = true.",
              inputSchema: z.object({
                itemName: z.string().describe("The name of the item to remove"),
                isConfirmed: z
                  .boolean()
                  .describe(
                    "Set to true only if the user explicitly said Yes to confirm this removal in the last turn.",
                  ),
              }),
              execute: async ({ itemName, isConfirmed }) => {
                const menu = (await getMenuData()) || [];
                const item = findMenuItem(menu, itemName);

                if (!item) {
                  return {
                    success: false,
                    error: `Menu item matching "${itemName}" was not found.`,
                  };
                }

                if (!isConfirmed) {
                  return {
                    success: false,
                    requiresConfirmation: true,
                    itemName: item.name,
                    message: `Please confirm that you want to remove "${item.name}".`,
                  };
                }

                const updatedMenu = menu.filter((m: any) => m.id !== item.id);
                await setMenuData(updatedMenu);
                return {
                  success: true,
                  itemId: item.id,
                  itemName: item.name,
                  removedItem: toMenuRecord(item),
                  message: `Successfully removed "${item.name}" from the menu.`,
                };
              },
            }),
          },
          system: `You are an efficient restaurant assistant for Chez Joe. Be brief, professional, and spoken-friendly.
You understand English, French, and Lebanese Arabic written in Latin characters.
When the user asks to add, update, or remove items, use the menu tools. Once a tool is called, provide the result clearly and always ask if the user needs further modifications to the menu.

Confirmation rules:
- Before addItem or removeItem changes the menu, ask the user to confirm the exact action.
- Call these tools with isConfirmed: false when confirmation is missing.
- Set isConfirmed: true only when the user explicitly confirms in the conversation history.
- Use editItem for direct, unambiguous name, price, or description edits. It does not need an isConfirmed field.
- Do not require confirmation for updateItemImage after the user has selected an upload file.

Image workflow:
- Immediately after a successful addItem tool call, say exactly: "Item added successfully! Would you like to upload a photo for this item?"

Examples:
- "3adele se3er l burger l 11 dollar" -> editItem for Heritage Burger with newPrice 11.
- "zid hummus 8 dollar" -> addItem for Hummus to 8.
- "m7e l garlic fries" -> removeItem for Garlic Fries.

Tool schema rules:
- addItem fields: name, price, isConfirmed, optional description, optional category.
- editItem fields: targetItemName, optional newName, optional newPrice, optional newDescription.
- updateItemPrice fields: itemName, newPrice, isConfirmed.
- removeItem fields: itemName, isConfirmed.
- updateItemImage fields: itemId plus one of imageKey, imageUrl, or base64Image.
- Prices may be numbers or strings.`,
          stopWhen: stepCountIs(5),
          onStepFinish({ toolCalls, toolResults }) {
            console.log("--- generateText Step Finished ---");
            console.log("Tool Calls:", JSON.stringify(toolCalls, null, 2));
            console.log(
              "Tool Results (before sending back to Groq):",
              JSON.stringify(toolResults, null, 2),
            );

            if (toolResults && toolResults.length > 0) {
              toolResults.forEach((r: any) => {
                if (r.result && r.result.success) {
                  if (isMenuMutationTool(r.toolName)) {
                    assistantState.reloadMenu = true;
                  }
                  const args = r.args ?? r.input ?? {};
                  const sharedMenuEvent = createMenuEvent(r.toolName, args, r.result);
                  if (r.toolName === "addItem") {
                    const createdItem =
                      sharedMenuEvent?.item ||
                      r.result.item || {
                        id: r.result.itemId || createMenuItemId(args.name),
                        name: args.name,
                        price: normalizePrice(args.price),
                        desc: args.description || "",
                        tag: args.category || "Signature",
                        imageKey: "plated",
                        isSoldOut: false,
                      };
                    assistantState.addedItem = createdItem;
                    assistantState.menuEvent = sharedMenuEvent;
                  }
                  if (r.toolName === "editItem") {
                    assistantState.menuEvent = sharedMenuEvent;
                  }
                  if (r.toolName === "updateItemPrice") {
                    assistantState.menuEvent = sharedMenuEvent;
                  }
                  if (r.toolName === "removeItem") {
                    assistantState.menuEvent = sharedMenuEvent;
                  }
                  if (r.toolName === "updateItemImage") {
                    assistantState.menuEvent = sharedMenuEvent;
                  }
                }
              });
            }
          },
        });

        const menuEvent = assistantState.menuEvent;
        const addedItem = assistantState.addedItem;
        const reloadMenu = assistantState.reloadMenu;

        let replyText = result.text || "I have processed your request.";
        if (menuEvent?.type === "addItem") {
          replyText = "Item added successfully! Would you like to upload a photo for this item?";
        } else if (
          menuEvent &&
          !/further modifications|more changes|anything else|need further/i.test(replyText)
        ) {
          replyText = `${replyText} Do you need any further modifications to the menu?`;
        }

        // Attempt TTS conversion via Deepgram
        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramKey) {
          return new Response(
            JSON.stringify({
              text: replyText,
              audio: null,
              reloadMenu,
              addedItem,
              menuEvent,
              warning: "DEEPGRAM_API_KEY is not set. Using browser text-to-speech fallback.",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        const ttsRes = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: replyText }),
        });

        if (!ttsRes.ok) {
          console.warn("Deepgram TTS API failed, returning text only:", await ttsRes.text());
          return new Response(
            JSON.stringify({
              text: replyText,
              audio: null,
              reloadMenu,
              addedItem,
              menuEvent,
              warning: "Deepgram TTS API failed. Using browser text-to-speech fallback.",
            }),
            {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }

        const audioBuffer = await ttsRes.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString("base64");
        const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;

        return new Response(
          JSON.stringify({
            text: replyText,
            audio: audioDataUrl,
            reloadMenu,
            addedItem,
            menuEvent,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      } catch (err: any) {
        console.error("--- Error in generateText / ai-assistant Endpoint ---");
        console.error(err);
        if (err.responseBody) {
          console.error("Response Body:", err.responseBody);
        }
        if (err.data) {
          console.error("Error Data:", err.data);
        }
        return new Response(
          JSON.stringify({
            error: err.message || "Internal Server Error",
            details: err.responseBody || err.data || null,
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
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
