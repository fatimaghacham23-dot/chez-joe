import { tool } from "ai";
import { z } from "zod";
import { getMenuData, setMenuData } from "./db";

const normalizePrice = (price: string | number) =>
  parseFloat(String(price).replace(/[^0-9.]/g, "")) || 0;
const createMenuItemId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
const findMenuItem = (menu: any[], itemName: string) => {
  const normalizedName = itemName.toLowerCase();
  const normalizedId = createMenuItemId(itemName);
  return menu.find(
    (m: any) =>
      m.name.toLowerCase().includes(normalizedName) ||
      m.id.toLowerCase() === normalizedName ||
      m.id.toLowerCase() === normalizedId,
  );
};
const toMenuRecord = (item: any) => ({
  id: item.id,
  name: item.name,
  desc: item.desc || "",
  price: normalizePrice(item.price),
  tag: item.tag || "Signature",
  imageKey: item.imageKey || "plated",
  isSoldOut: Boolean(item.isSoldOut),
});

export const assistantTools = {
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
      itemName: z.string().describe("The name of the menu item (e.g. burger, tawook, halloumi)"),
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
        return { success: false, error: `Menu item matching "${itemName}" was not found.` };
      }

      if (!isConfirmed) {
        return {
          success: false,
          requiresConfirmation: true,
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

  addItem: tool({
    description:
      "Add a new menu item to the restaurant. Safety reminder: verbally ask the user to confirm with Yes before calling this tool with isConfirmed = true.",
    inputSchema: z.object({
      name: z.string().describe("The name of the menu item"),
      price: z.union([z.string(), z.number()]).describe("The price of the item"),
      isConfirmed: z.boolean().describe("Whether the user has confirmed the addition"),
      description: z.string().optional().describe("Optional description of the item"),
      category: z.string().optional().describe("Optional category"),
    }),
    execute: async ({ name, price, isConfirmed, description, category }) => {
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
  }),

  updateItemImage: tool({
    description: "Update the image URL or base64 key of an existing menu item.",
    inputSchema: z.object({
      itemId: z.string().describe("The ID of the menu item (e.g. garlic_fries)"),
      imageKey: z.string().describe("The new image URL, base64 data string, or preset key"),
    }),
    execute: async ({ itemId, imageKey }) => {
      try {
        const menu = (await getMenuData()) || [];
        const item = findMenuItem(menu, itemId);

        if (!item) {
          return { success: false, error: `Menu item with ID or name "${itemId}" was not found.` };
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
        return { success: false, error: `Menu item matching "${itemName}" was not found.` };
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
};
