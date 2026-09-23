import { LocalStore } from "../../core/storage/localStore.js";

const KEY = "optimizedModeEnabled";
const listeners = new Set();
let cachedEnabled = null;

export const OptimizedModeStore = {
  isEnabled() {
    if (cachedEnabled === null) {
      cachedEnabled = Boolean(LocalStore.get(KEY, false));
    }
    return cachedEnabled;
  },

  setEnabled(enabled) {
    const next = Boolean(enabled);
    if (next === this.isEnabled()) return next;
    cachedEnabled = next;
    LocalStore.set(KEY, next);
    listeners.forEach((listener) => listener(next));
    return next;
  },

  subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};
