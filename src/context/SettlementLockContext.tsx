import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { AuthContext } from "./AuthContext";
import { apiClient } from "../utils/apiClient";

type Ctx = {
  settlementLocked: boolean;
  refreshSettlementLock: () => Promise<void>;
};

export const SettlementLockContext = createContext<Ctx>({
  settlementLocked: false,
  refreshSettlementLock: async () => {},
});

export function SettlementLockProvider({ children }: { children: ReactNode }) {
  const { token } = useContext(AuthContext);
  const [settlementLocked, setSettlementLocked] = useState(false);

  const refreshSettlementLock = useCallback(async () => {
    if (!token) {
      setSettlementLocked(false);
      return;
    }
    try {
      const p = await apiClient("/profile", "GET", undefined, token);
      setSettlementLocked(!!(p as { has_pending_settlements?: boolean })?.has_pending_settlements);
    } catch {
      setSettlementLocked(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshSettlementLock();
  }, [refreshSettlementLock]);

  return (
    <SettlementLockContext.Provider
      value={{ settlementLocked, refreshSettlementLock }}
    >
      {children}
    </SettlementLockContext.Provider>
  );
}

export function useSettlementLock() {
  return useContext(SettlementLockContext);
}
