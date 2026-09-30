/**
 * Compunnel Clinical Intelligence — Auth Store (Zustand)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setTokenGetter, type UserProfile } from './api';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  setAuth: (token: string, user: UserProfile) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export function normalizeUserRole(role: string | null | undefined): string {
  const normalized = role?.trim().toLowerCase();
  if (normalized === "clinician" || normalized === "physician" || normalized === "medical_staff") {
    return "doctor";
  }
  return normalized || "patient";
}

// Client-issued tokens used only when login couldn't reach the backend. They are
// rejected by any live backend, so a healthy backend must never keep using one.
const SYNTHETIC_TOKENS = new Set(["demo-offline-access-token", "admin-console-session-token"]);

export function isSyntheticToken(token: string | null | undefined): boolean {
  return !!token && SYNTHETIC_TOKENS.has(token);
}

function normalizeUser(user: UserProfile | null): UserProfile | null {
  return user ? { ...user, role: normalizeUserRole(user.role) } : null;
}

const memoryStore = new Map<string, string>();

const safeStorage = createJSONStorage(() => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Test storage access
      window.localStorage.getItem('test');
      return window.localStorage;
    }
  } catch {
    // Storage restricted (e.g. iframe partitioning)
  }
  return {
    getItem: (key: string) => memoryStore.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStore.set(key, value),
    removeItem: (key: string) => memoryStore.delete(key),
  };
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user: normalizeUser(user) }),
      setUser: (user) => set({ user: normalizeUser(user) as UserProfile }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'healthcare-auth',
      storage: safeStorage,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthState>;
        return {
          ...currentState,
          ...persisted,
          user: normalizeUser(persisted.user ?? null),
        };
      },
    }
  )
);

// Wire up the API client to read the token from the store
if (typeof window !== 'undefined') {
  setTokenGetter(() => useAuthStore.getState().token);
}
