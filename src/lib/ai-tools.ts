import { tool } from 'ai';
import { z } from 'zod';
import { getMenuData, setMenuData } from './db';

export const assistantTools = {
  getMenu: tool({
    description: 'Retrieve the current list of menu items with their details.',
    parameters: z.object({}),
    execute: async () => {
      const menu = await getMenuData();
      return { success: true, menu };
    }
  }),

  updatePrice: tool({
    description: 'Update the price of an existing menu item.',
    parameters: z.object({
      itemName: z.string().describe('The name of the menu item (e.g. burger, tawook, halloumi)'),
      newPrice: z.number().describe('The new price in USD')
    }),
    execute: async ({ itemName, newPrice }) => {
      const menu = await getMenuData() || [];
      const item = menu.find((m: any) => m.name.toLowerCase().includes(itemName.toLowerCase()) || m.id.toLowerCase() === itemName.toLowerCase());
      
      if (!item) {
        return { success: false, error: `Menu item matching "${itemName}" was not found.` };
      }
      
      item.price = newPrice;
      await setMenuData(menu);
      return { success: true, message: `Updated the price of ${item.name} to $${newPrice.toFixed(2)}.` };
    }
  }),

  addItem: tool({
    description: 'Add a new menu item to the restaurant. Safety reminder: verbally ask the user to confirm with Yes before calling this tool with isConfirmed = true.',
    parameters: z.object({
      name: z.string().describe('The name of the new item'),
      price: z.number().describe('The price in USD'),
      description: z.string().optional().describe('Short description of the dish'),
      category: z.string().optional().describe('Category tag (e.g. Signature, House Favorite, Side, Beverage)'),
      isConfirmed: z.boolean().describe('Set to true only if the user explicitly said Yes to confirm this addition in the last turn.')
    }),
    execute: async ({ name, price, description, category, isConfirmed }) => {
      if (!isConfirmed) {
        return { success: false, requiresConfirmation: true, message: `Please confirm that you want to add ${name} for $${price.toFixed(2)}.` };
      }

      try {
        const menu = await getMenuData() || [];
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        
        if (menu.some((m: any) => m.id === id)) {
          return { success: false, error: `An item with id "${id}" already exists.` };
        }

        const newItem = {
          id,
          name,
          desc: description || "",
          price,
          tag: category || "Signature",
          imageKey: 'plated', // Default fallback image key
          isSoldOut: false
        };

        menu.push(newItem);
        await setMenuData(menu);
        return { success: true, itemId: id, message: `Successfully added "${name}" to the menu.` };
      } catch (err: any) {
        return { success: false, error: `Database write failed: ${err.message}` };
      }
    }
  }),

  updateItemImage: tool({
    description: 'Update the image URL or base64 key of an existing menu item.',
    parameters: z.object({
      itemId: z.string().describe('The ID of the menu item (e.g. garlic_fries)'),
      imageKey: z.string().describe('The new image URL, base64 data string, or preset key')
    }),
    execute: async ({ itemId, imageKey }) => {
      try {
        const menu = await getMenuData() || [];
        const item = menu.find((m: any) => m.id === itemId || m.name.toLowerCase() === itemId.toLowerCase() || m.id.toLowerCase() === itemId.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
        
        if (!item) {
          return { success: false, error: `Menu item with ID or name "${itemId}" was not found.` };
        }
        
        item.imageKey = imageKey;
        await setMenuData(menu);
        return { success: true, message: `Successfully updated the image for "${item.name}".` };
      } catch (err: any) {
        return { success: false, error: `Database write failed: ${err.message}` };
      }
    }
  }),

  removeItem: tool({
    description: 'Remove a menu item from the restaurant database. Safety reminder: verbally ask the user to confirm with Yes before calling this tool with isConfirmed = true.',
    parameters: z.object({
      itemName: z.string().describe('The name of the item to remove'),
      isConfirmed: z.boolean().describe('Set to true only if the user explicitly said Yes to confirm this removal in the last turn.')
    }),
    execute: async ({ itemName, isConfirmed }) => {
      const menu = await getMenuData() || [];
      const item = menu.find((m: any) => m.name.toLowerCase().includes(itemName.toLowerCase()) || m.id.toLowerCase() === itemName.toLowerCase());
      
      if (!item) {
        return { success: false, error: `Menu item matching "${itemName}" was not found.` };
      }

      if (!isConfirmed) {
        return { success: false, requiresConfirmation: true, itemName: item.name, message: `Please confirm that you want to remove "${item.name}".` };
      }

      const updatedMenu = menu.filter((m: any) => m.id !== item.id);
      await setMenuData(updatedMenu);
      return { success: true, message: `Successfully removed "${item.name}" from the menu.` };
    }
  })
};
