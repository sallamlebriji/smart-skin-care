import { create } from "zustand";
export interface Account { id: string; email: string }
export const useAuthStore = create<{
  user: Account | null;
  loading: boolean;
  setUser: (user: Account | null) => void;
}>((set) => ({ user: null, loading: true, setUser: (user) => set({ user, loading: false }) }));
