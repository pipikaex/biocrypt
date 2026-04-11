import { useState, useCallback } from "react";

const STORAGE_KEY = "zcoin-demo-user";

export interface DemoUser {
  publicKeyHash: string;
  connectedAt: number;
}

export function useUser() {
  const [user, setUserState] = useState<DemoUser | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const setUser = useCallback((u: DemoUser | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return { user, setUser };
}
