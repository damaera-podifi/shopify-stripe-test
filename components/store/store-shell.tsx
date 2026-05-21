"use client";

import type { ReactNode } from "react";
import { CartCountProvider } from "@/components/store/cart-count-context";
import { StoreHeader } from "@/components/store/store-header";
import type { StoreSession } from "@/lib/auth/session";

type StoreShellProps = {
  initialCartCount: number;
  shopName: string;
  shopUrl: string;
  session: StoreSession | null;
  children: ReactNode;
};

export function StoreShell({
  initialCartCount,
  shopName,
  shopUrl,
  session,
  children,
}: StoreShellProps) {
  return (
    <CartCountProvider initialCount={initialCartCount}>
      <div className="min-h-full bg-zinc-50 font-sans dark:bg-black">
        <StoreHeader shopName={shopName} shopUrl={shopUrl} session={session} />
        {children}
      </div>
    </CartCountProvider>
  );
}
