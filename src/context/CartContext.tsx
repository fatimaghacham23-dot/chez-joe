import React, { createContext, useContext, useState, useEffect } from "react";

export interface CartItem {
  cartItemId: string; // id + "-" + notes
  id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  imageKey: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: { id: string; name: string; price: number; imageKey: string }, quantity: number, notes: string) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartSubtotal: number;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("chezjoe_cart");
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart from localStorage", e);
      }
    }
  }, []);

  // Save cart to localStorage when it changes
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem("chezjoe_cart", JSON.stringify(newCart));
  };

  const addToCart = (
    item: { id: string; name: string; price: number; imageKey: string },
    quantity: number,
    notes: string
  ) => {
    const trimmedNotes = notes.trim();
    const cartItemId = `${item.id}-${trimmedNotes}`;

    const existingIndex = cart.findIndex((i) => i.cartItemId === cartItemId);
    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += quantity;
      saveCart(newCart);
    } else {
      const newCart = [
        ...cart,
        {
          cartItemId,
          id: item.id,
          name: item.name,
          price: item.price,
          quantity,
          notes: trimmedNotes,
          imageKey: item.imageKey,
        },
      ];
      saveCart(newCart);
    }
  };

  const removeFromCart = (cartItemId: string) => {
    const newCart = cart.filter((i) => i.cartItemId !== cartItemId);
    saveCart(newCart);
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    const newCart = cart.map((i) =>
      i.cartItemId === cartItemId ? { ...i, quantity } : i
    );
    saveCart(newCart);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        cartSubtotal,
        cartDrawerOpen,
        setCartDrawerOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
