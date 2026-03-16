declare module 'expo-secure-store' {
  export function setItemAsync(
    key: string,
    value: string,
    options?: { keychainService?: string }
  ): Promise<void>;

  export function getItemAsync(
    key: string,
    options?: { keychainService?: string }
  ): Promise<string | null>;

  export function deleteItemAsync(
    key: string,
    options?: { keychainService?: string }
  ): Promise<void>;
}