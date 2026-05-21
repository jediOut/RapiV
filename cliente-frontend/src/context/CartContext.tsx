import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { CartItem, Product } from '../types/business';

type CartState = {
  items: CartItem[];
};

type CartAction =
  | { type: 'ADD_ITEM'; product: Product; quantity: number }
  | { type: 'REMOVE_ITEM'; productId: string }
  | { type: 'UPDATE_QUANTITY'; productId: string; quantity: number }
  | { type: 'CLEAR_CART' };

type CartContextValue = {
  cart: CartItem[];
  itemCount: number;
  subtotalCents: number;
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find((item) => item.product.id === action.product.id);

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.product.id === action.product.id
              ? { ...item, quantity: item.quantity + action.quantity }
              : item
          )
        };
      }

      return {
        items: [...state.items, { product: action.product, quantity: action.quantity }]
      };
    }
    case 'REMOVE_ITEM':
      return { items: state.items.filter((item) => item.product.id !== action.productId) };
    case 'UPDATE_QUANTITY':
      return {
        items: state.items
          .map((item) =>
            item.product.id === action.productId
              ? { ...item, quantity: action.quantity }
              : item
          )
          .filter((item) => item.quantity > 0)
      };
    case 'CLEAR_CART':
      return { items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });

  const cart = state.items;

  const value = useMemo(
    () => ({
      cart,
      itemCount: cart.reduce((sum, item) => sum + item.quantity, 0),
      subtotalCents: cart.reduce((sum, item) => sum + item.product.priceCents * item.quantity, 0),
      addToCart: (product: Product, quantity: number) =>
        dispatch({ type: 'ADD_ITEM', product, quantity }),
      removeFromCart: (productId: string) => dispatch({ type: 'REMOVE_ITEM', productId }),
      updateQuantity: (productId: string, quantity: number) =>
        dispatch({ type: 'UPDATE_QUANTITY', productId, quantity }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' })
    }),
    [cart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }

  return context;
}
