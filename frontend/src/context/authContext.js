import { createContext, useContext } from "react";

/**
 * Context and hook live apart from the provider component so the provider file
 * only exports components — otherwise Fast Refresh loses state on every edit.
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
