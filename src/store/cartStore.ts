import { create } from 'zustand';
import type { CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  
  addItem: (item) => set((state) => {
    const existingIndex = state.items.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      const newItems = [...state.items];
      newItems[existingIndex].quantity += item.quantity;
      return { items: newItems };
    }
    return { items: [...state.items, item] };
  }),
  
  removeItem: (id) => set((state) => ({
    items: state.items.filter(i => i.id !== id),
  })),
  
  updateQuantity: (id, quantity) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, quantity } : i),
  })),
  
  clearCart: () => set({ items: [] }),
  
  total: () => {
    const { items } = get();
    return items.reduce((sum, item) => sum + item.priceSEK * item.quantity, 0);
  },
}));
