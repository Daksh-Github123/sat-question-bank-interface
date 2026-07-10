"use client";

import { createContext, useContext } from "react";
import type { AppUser } from "./user";

interface UserCtx {
  user: AppUser | null;
  setUser: (u: AppUser | null) => void;
}

export const UserContext = createContext<UserCtx>({ user: null, setUser: () => {} });

export function useUser() {
  return useContext(UserContext);
}
