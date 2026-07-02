"use client";

if (typeof window !== "undefined") {
  try {
    const test1 = window.localStorage;
    const test2 = window.sessionStorage;
  } catch (e) {
    console.warn("Storage access denied, falling back to memory storage.");
    
    const createMemoryStorage = () => {
      let store: Record<string, string> = {};
      return {
        getItem(key: string) {
          return store[key] || null;
        },
        setItem(key: string, value: string) {
          store[key] = value.toString();
        },
        removeItem(key: string) {
          delete store[key];
        },
        clear() {
          store = {};
        },
        key(index: number) {
          const keys = Object.keys(store);
          return keys[index] || null;
        },
        get length() {
          return Object.keys(store).length;
        }
      };
    };

    const mockLocalStorage = createMemoryStorage();
    const mockSessionStorage = createMemoryStorage();

    try {
      Object.defineProperty(window, "localStorage", {
        value: mockLocalStorage,
        configurable: true,
        enumerable: true,
        writable: false
      });
    } catch (e) {}

    try {
      Object.defineProperty(window, "sessionStorage", {
        value: mockSessionStorage,
        configurable: true,
        enumerable: true,
        writable: false
      });
    } catch (e) {}
  }
}
