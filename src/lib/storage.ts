/**
 * Storage Utility
 * 
 * Provides a simple abstraction over localStorage with mock encryption (Base64).
 * In a real-world scenario, you would use CryptoJS or similar for real encryption
 * if persisting sensitive data on the client side is absolutely necessary.
 */

export const secureStorage = {
  setItem: (key: string, value: any): void => {
    try {
      const stringifiedValue = JSON.stringify(value);
      // Use btoa as a basic obfuscator to simulate secure storage.
      // Do not use in production for actual sensitive data.
      const encodedValue = btoa(encodeURI(stringifiedValue));
      localStorage.setItem(`secure_${key}`, encodedValue);
    } catch (e) {
      console.error('Error saving to secure storage', e);
    }
  },

  getItem: <T>(key: string): T | null => {
    try {
      const encodedValue = localStorage.getItem(`secure_${key}`);
      if (!encodedValue) return null;
      
      const stringifiedValue = decodeURI(atob(encodedValue));
      return JSON.parse(stringifiedValue) as T;
    } catch (e) {
      console.error('Error reading from secure storage', e);
      return null;
    }
  },

  removeItem: (key: string): void => {
    try {
      localStorage.removeItem(`secure_${key}`);
    } catch (e) {
      console.error('Error removing from secure storage', e);
    }
  }
};
