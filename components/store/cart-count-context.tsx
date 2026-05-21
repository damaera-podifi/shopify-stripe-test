"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type CartCountContextValue = {
  count: number;
  addOptimistic: (quantity: number) => void;
  setCount: (count: number) => void;
  clearCount: () => void;
};

const CartCountContext = createContext<CartCountContextValue | null>(null);

export function CartCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCountState] = useState(initialCount);

  const addOptimistic = useCallback((quantity: number) => {
    setCountState((current) => Math.max(0, current + quantity));
  }, []);

  const setCount = useCallback((next: number) => {
    setCountState(Math.max(0, next));
  }, []);

  const clearCount = useCallback(() => {
    setCountState(0);
  }, []);

  const value = useMemo(
    () => ({ count, addOptimistic, setCount, clearCount }),
    [count, addOptimistic, setCount, clearCount],
  );

  return (
    <CartCountContext.Provider value={value}>{children}</CartCountContext.Provider>
  );
}

export function useCartCount() {
  const context = useContext(CartCountContext);
  if (!context) {
    throw new Error("useCartCount must be used within CartCountProvider");
  }
  return context;
}

/** Resets the header badge after checkout clears the server cart. */
export function CartCountReset() {
  const { clearCount } = useCartCount();

  useEffect(() => {
    clearCount();
  }, [clearCount]);

  return null;
}
