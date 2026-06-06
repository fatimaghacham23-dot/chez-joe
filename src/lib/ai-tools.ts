import { tool } from "ai";
import { z } from "zod";
import { getMenuData, setMenuData } from "./db";

export type MenuRecord = {
  id: string;
  name: string;
  desc: string;
  price: number;
  tag: string;
  imageKey: string;
  isSoldOut: boolean;
};

export type MenuEventPayload = {
  type: "addItem" | "editItem" | "updateItemPrice" | "removeItem" | "updateItemImage";
  itemId?: string;
  itemName?: string;
  item?: MenuRecord;
  removedItem?: MenuRecord;
  newPrice?: number;
  imageKey?: string;
  message?: string;
};

export type MenuToolName =
  | "getMenu"
  | "addItem"
  | "editItem"
  | "updateItemPrice"
  | "updateItemImage"
  | "removeItem";

type ToolResult = Record<string, unknown> & {
  success?: boolean;
  item?: MenuRecord;
  removedItem?: MenuRecord;
  itemId?: string;
  itemName?: string;
  newPrice?: number;
  imageKey?: string;
  message?: string;
};

export const REALTIME_VOICE_SYSTEM_PROMPT =
  "You are a professional restaurant voice assistant. You are now in a real-time call. You must be brief, listen actively, and perform requested menu updates immediately via tools if instructed. If you need confirmation, ask clearly and wait for the user response.";

export const normalizePrice = (price: string | number) =>
  parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;

export const createMenuItemId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const findMenuItem = (menu: any[], itemName: string) => {
  const normalizedName = itemName.toLowerCase();
  const normalizedId = createMenuItemId(itemName);
  return menu.find(
    (m: any) =>
      m.name.toLowerCase().includes(normalizedName) ||
      m.id.toLowerCase() === normalizedName ||
      m.id.toLowerCase() === normalizedId,
  );
};

export const toMenuRecord = (item: any): MenuRecord => ({
  id: item.id,
  name: item.name,
  desc: item.desc || "",
  price: normalizePrice(item.price),
  tag: item.tag || "Signature",
  imageKey: item.imageKey || "plated",
  isSoldOut: Boolean(item.isSoldOut),
});

const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "";

const coerceImageSource = (args: Record<string, unknown>) => {
  const imageSource =
    args.imageKey ?? args.imageUrl ?? args.base64Image ?? args.image ?? args.url ?? args.dataUrl;
  return typeof imageSource === "string" ? imageSource.trim() : "";
};

const isAcceptedImageSource = (imageSource: string) =>
  /^data:image\/[a-z0-9.+-]+;base64,/i.test(imageSource) ||
  /^https?:\/\/\S+/i.test(imageSource) ||
  /^[a-z0-9_-]+$/i.test(imageSource);

export const isMenuMutationTool = (toolName: string) =>
  toolName === "addItem" ||
  toolName === "editItem" ||
  toolName === "updateItemPrice" ||
  toolName === "removeItem" ||
  toolName === "updateItemImage";

export async function executeMenuTool(toolName: MenuToolName, args: Record<string, any> = {}) {
  if (toolName === "getMenu") {
    const menu = await getMenuData();
    return { success: true, menu };
  }

  if (toolName === "updateItemPrice") {
    const menu = (await getMenuData()) || [];
    const item = findMenuItem(menu, args.itemName || args.targetItemName || "");
    const numericPrice = normalizePrice(args.newPrice);

    if (!item) {
      return {
        success: false,
        error: `Menu item matching "${args.itemName || args.targetItemName}" was not found.`,
      };
    }

    if (!args.isConfirmed) {
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
  }

  if (toolName === "addItem") {
    const numericPrice = normalizePrice(args.price);
    if (!args.isConfirmed) {
      return {
        success: false,
        requiresConfirmation: true,
        message: `Please confirm that you want to add ${args.name} for $${numericPrice.toFixed(2)}.`,
      };
    }

    try {
      const menu = (await getMenuData()) || [];
      const id = createMenuItemId(args.name);

      if (menu.some((m: any) => m.id === id)) {
        return { success: false, error: `An item with id "${id}" already exists.` };
      }

      const newItem = {
        id,
        name: args.name,
        desc: args.description || "",
        price: numericPrice,
        tag: args.category || "Signature",
        imageKey: "plated",
        isSoldOut: false,
      };

      menu.push(newItem);
      await setMenuData(menu);
      return {
        success: true,
        itemId: id,
        itemName: args.name,
        item: toMenuRecord(newItem),
        message: `Successfully added "${args.name}" to the menu.`,
      };
    } catch (err: any) {
      return { success: false, error: `Database write failed: ${err.message}` };
    }
  }

  if (toolName === "editItem") {
    try {
      const menu = (await getMenuData()) || [];
      const item = findMenuItem(menu, args.targetItemName || args.itemName || "");

      if (!item) {
        return {
          success: false,
          error: `Menu item matching "${args.targetItemName || args.itemName}" was not found.`,
        };
      }

      const updates: string[] = [];

      if (hasValue(args.newName)) {
        item.name = String(args.newName).trim();
        updates.push("name");
      }

      if (hasValue(args.newPrice)) {
        item.price = normalizePrice(args.newPrice);
        updates.push("price");
      }

      if (hasValue(args.newDescription)) {
        item.desc = String(args.newDescription).trim();
        updates.push("description");
      }

      if (updates.length === 0) {
        return {
          success: false,
          itemId: item.id,
          itemName: item.name,
          error: "No editable fields were provided.",
        };
      }

      await setMenuData(menu);
      return {
        success: true,
        itemId: item.id,
        itemName: item.name,
        item: toMenuRecord(item),
        message: `Updated ${item.name}: ${updates.join(", ")}.`,
      };
    } catch (err: any) {
      return { success: false, error: `Database write failed: ${err.message}` };
    }
  }

  if (toolName === "updateItemImage") {
    try {
      const menu = (await getMenuData()) || [];
      const itemId = args.itemId || args.itemName || args.targetItemName || "";
      const item = findMenuItem(menu, itemId);
      const imageKey = coerceImageSource(args);

      if (!item) {
        return { success: false, error: `Menu item with ID or name "${itemId}" was not found.` };
      }

      if (!imageKey || !isAcceptedImageSource(imageKey)) {
        return {
          success: false,
          itemId: item.id,
          itemName: item.name,
          error: "Image source must be a preset key, an image URL, or a base64 data URL.",
        };
      }

      item.imageKey = imageKey;
      await setMenuData(menu);
      return {
        success: true,
        itemId: item.id,
        itemName: item.name,
        imageKey,
        item: toMenuRecord(item),
        message: `Successfully updated the image for "${item.name}".`,
      };
    } catch (err: any) {
      return { success: false, error: `Database write failed: ${err.message}` };
    }
  }

  if (toolName === "removeItem") {
    const menu = (await getMenuData()) || [];
    const item = findMenuItem(menu, args.itemName || args.targetItemName || "");

    if (!item) {
      return { success: false, error: `Menu item matching "${args.itemName}" was not found.` };
    }

    if (!args.isConfirmed) {
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
  }

  return { success: false, error: `Unknown tool "${toolName}".` };
}

export function createMenuEvent(
  toolName: string,
  args: Record<string, any> = {},
  result: ToolResult | undefined,
): MenuEventPayload | null {
  if (!result?.success || !isMenuMutationTool(toolName)) return null;

  if (toolName === "addItem") {
    const createdItem =
      result.item ||
      ({
        id: result.itemId || createMenuItemId(args.name),
        name: args.name,
        price: normalizePrice(args.price),
        desc: args.description || "",
        tag: args.category || "Signature",
        imageKey: "plated",
        isSoldOut: false,
      } as MenuRecord);
    return {
      type: "addItem",
      itemId: createdItem.id,
      itemName: createdItem.name,
      item: createdItem,
      message: result.message,
    };
  }

  if (toolName === "editItem") {
    return {
      type: "editItem",
      itemId: result.itemId,
      itemName: result.itemName || args.targetItemName,
      item: result.item,
      newPrice: result.item?.price ?? normalizePrice(args.newPrice || 0),
      message: result.message,
    };
  }

  if (toolName === "updateItemPrice") {
    return {
      type: "updateItemPrice",
      itemId: result.itemId,
      itemName: result.itemName || args.itemName,
      item: result.item,
      newPrice: result.newPrice ?? normalizePrice(args.newPrice),
      message: result.message,
    };
  }

  if (toolName === "removeItem") {
    return {
      type: "removeItem",
      itemId: result.itemId,
      itemName: result.itemName || args.itemName,
      removedItem: result.removedItem,
      message: result.message,
    };
  }

  if (toolName === "updateItemImage") {
    return {
      type: "updateItemImage",
      itemId: result.itemId,
      itemName: result.itemName || args.itemId || args.itemName || args.targetItemName,
      item: result.item,
      imageKey: result.imageKey || coerceImageSource(args),
      message: result.message,
    };
  }

  return null;
}

export const realtimeToolDefinitions = [
  {
    type: "function",
    name: "getMenu",
    description:
      "Retrieve the current list of menu items with names, descriptions, prices, tags, image keys, and sold-out status.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "addItem",
    description:
      "Add a new menu item to the restaurant after the caller clearly asks for it. Use isConfirmed true when the caller gave a direct instruction.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the menu item." },
        price: {
          anyOf: [{ type: "string" }, { type: "number" }],
          description: "The item price in USD.",
        },
        isConfirmed: {
          type: "boolean",
          description: "True when the caller directly instructed or confirmed the addition.",
        },
        description: { type: "string", description: "Optional menu description." },
        category: { type: "string", description: "Optional menu category or tag." },
      },
      required: ["name", "price", "isConfirmed"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "editItem",
    description:
      "Edit an existing item name, price, and/or description immediately when the caller gives a direct update instruction.",
    parameters: {
      type: "object",
      properties: {
        targetItemName: {
          type: "string",
          description: "The current menu item name or id to find.",
        },
        newName: { type: "string", description: "Optional replacement item name." },
        newPrice: {
          anyOf: [{ type: "string" }, { type: "number" }],
          description: "Optional replacement price in USD.",
        },
        newDescription: {
          type: "string",
          description: "Optional replacement menu description.",
        },
      },
      required: ["targetItemName"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "updateItemImage",
    description:
      "Update the image for an existing menu item using a preset image key, an https image URL, or a base64 data URL.",
    parameters: {
      type: "object",
      properties: {
        itemId: { type: "string", description: "The menu item id or name." },
        imageKey: {
          type: "string",
          description: "Preset key, image URL, or base64 data URL.",
        },
        imageUrl: {
          type: "string",
          description: "Optional direct http or https image URL.",
        },
        base64Image: {
          type: "string",
          description: "Optional base64 data URL for the image.",
        },
      },
      required: ["itemId"],
      additionalProperties: false,
    },
  },
];

export const assistantTools = {
  getMenu: tool({
    description: "Retrieve the current list of menu items with their details.",
    inputSchema: z.object({}),
    execute: async () => executeMenuTool("getMenu"),
  }),

  updateItemPrice: tool({
    description: "Update the price of an existing menu item after explicit confirmation.",
    inputSchema: z.object({
      itemName: z.string().describe("The name of the menu item (e.g. burger, tawook, halloumi)"),
      newPrice: z.union([z.string(), z.number()]).describe("The new price in USD"),
      isConfirmed: z
        .boolean()
        .describe(
          "Set to true only if the user explicitly confirmed the price change in the last turn.",
        ),
    }),
    execute: async (args) => executeMenuTool("updateItemPrice", args),
  }),

  addItem: tool({
    description:
      "Add a new menu item to the restaurant. Safety reminder: ask the user to confirm with Yes before calling this tool with isConfirmed = true.",
    inputSchema: z.object({
      name: z.string().describe("The name of the menu item"),
      price: z.union([z.string(), z.number()]).describe("The price of the item"),
      isConfirmed: z.boolean().describe("Whether the user has confirmed the addition"),
      description: z.string().optional().describe("Optional description of the item"),
      category: z.string().optional().describe("Optional category"),
    }),
    execute: async (args) => executeMenuTool("addItem", args),
  }),

  editItem: tool({
    description:
      "Edit an existing menu item. Use this for direct name, price, and description updates.",
    inputSchema: z.object({
      targetItemName: z.string().describe("The current item name or id to update"),
      newName: z.string().optional().describe("Optional new menu item name"),
      newPrice: z.union([z.string(), z.number()]).optional().describe("Optional new price in USD"),
      newDescription: z.string().optional().describe("Optional new item description"),
    }),
    execute: async (args) => executeMenuTool("editItem", args),
  }),

  updateItemImage: tool({
    description:
      "Update the image of an existing menu item using a preset key, a base64 image data URL, or an http/https image URL.",
    inputSchema: z.object({
      itemId: z.string().describe("The ID or name of the menu item (e.g. garlic_fries)"),
      imageKey: z.string().optional().describe("The preset image key, image URL, or base64 data URL"),
      imageUrl: z.string().optional().describe("An http or https image URL"),
      base64Image: z.string().optional().describe("A base64 data URL"),
    }),
    execute: async (args) => executeMenuTool("updateItemImage", args),
  }),

  removeItem: tool({
    description:
      "Remove a menu item from the restaurant database. Safety reminder: ask the user to confirm with Yes before calling this tool with isConfirmed = true.",
    inputSchema: z.object({
      itemName: z.string().describe("The name of the item to remove"),
      isConfirmed: z
        .boolean()
        .describe(
          "Set to true only if the user explicitly said Yes to confirm this removal in the last turn.",
        ),
    }),
    execute: async (args) => executeMenuTool("removeItem", args),
  }),
};
