import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: number;
  productName: string;
  unit: string;
  price: number;
  quantity: number;
  imageUrl?: string | null;
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getItemCount: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const { items } = get();
        const existingItem = items.find((i) => i.productId === item.productId);
        
        if (existingItem) {
          set({
            items: items.map((i) => 
              i.productId === item.productId 
                ? { ...i, quantity: i.quantity + item.quantity } 
                : i
            ),
          });
        } else {
          set({ items: [...items, item] });
        }
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },
      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) => 
            i.productId === productId ? { ...i, quantity } : i
          ),
        });
      },
      clearCart: () => set({ items: [] }),
      getCartTotal: () => {
        return get().items.reduce((total: number, item: CartItem) => total + (item.price * item.quantity), 0);
      },
      getItemCount: () => {
        return get().items.reduce((count: number, item: CartItem) => count + item.quantity, 0);
      },
    }),
    {
      name: 'supplygrid-cart',
    }
  )
);
