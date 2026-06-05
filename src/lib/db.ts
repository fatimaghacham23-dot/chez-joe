import fs from 'fs';
import path from 'path';
import { kv } from '@vercel/kv';

export const DEFAULT_MENU = [
  { id: "tawook", name: "Charcoal-Grilled Tawouk Essence", desc: "Overnight-marinated chicken breast, open charcoal flame, garlic emulsion.", price: 14.00, tag: "Signature", imageKey: "tawook", isSoldOut: false },
  { id: "burger", name: "The Heritage Burger", desc: "Hand-pressed beef, brioche bun, vibrant slaw, signature sauce.", price: 16.00, tag: "House Favorite", imageKey: "burger", isSoldOut: false },
  { id: "francisco", name: "The Francisco Submarine", desc: "Slow-roasted chicken, charred corn, imported mozzarella, artisan baguette.", price: 15.00, tag: "Chef's Pick", imageKey: "francisco", isSoldOut: false },
  { id: "hummus", name: "Hummus Blend", desc: "Creamy chickpea puree, tahini, olive oil, fresh pita.", price: 8.00, tag: "Classic App", imageKey: "plated", isSoldOut: false },
  { id: "tabbouleh", name: "Fresh Tabbouleh Salat", desc: "Finely chopped parsley, tomatoes, mint, onion, bulgur, lemon-olive oil dressing.", price: 9.00, tag: "Fresh Green", imageKey: "plated", isSoldOut: false },
  { id: "garlic_fries", name: "Garlic Fries", desc: "Crispy golden fries tossed in garlic coriander oil.", price: 6.00, tag: "Side", imageKey: "kitchen", isSoldOut: false },
  { id: "halloumi", name: "Grilled Halloumi", desc: "Slices of grilled halloumi cheese served with mint and cucumber.", price: 10.00, tag: "Side", imageKey: "sandwish", isSoldOut: false }
];

const MOCK_FILE_PATH = path.join(process.cwd(), 'menu-db.json');

export async function getMenuData() {
  if (process.env.KV_REST_API_URL) {
    try {
      const data = await kv.get('menu');
      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
    } catch (e) {
      console.warn("KV Connection failed, using mock persistence:", e);
    }
  }

  // Fallback to local mock file persistence
  if (fs.existsSync(MOCK_FILE_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(MOCK_FILE_PATH, 'utf-8'));
    } catch (e) {
      console.error("Failed to read local mock file:", e);
    }
  }
  return null;
}

export async function setMenuData(data: any) {
  if (process.env.KV_REST_API_URL) {
    try {
      await kv.set('menu', JSON.stringify(data));
      return;
    } catch (e) {
      console.warn("KV Connection failed, using mock persistence:", e);
    }
  }

  // Fallback to local mock file persistence
  fs.writeFileSync(MOCK_FILE_PATH, JSON.stringify(data, null, 2));
}
