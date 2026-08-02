import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "error loading dynamically imported module",
  "chunkloaderror",
  "loading chunk",
];

export function isDynamicImportError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const normalized = message.toLowerCase();
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some(pattern => normalized.includes(pattern));
}

export async function importWithSingleReload<T>(
  importer: () => Promise<T>,
  retryKey: string,
  reload: () => void = () => window.location.reload(),
): Promise<T> {
  try {
    const module = await importer();
    window.sessionStorage.removeItem(retryKey);
    return module;
  } catch (error) {
    if (
      typeof window !== "undefined" &&
      isDynamicImportError(error) &&
      window.sessionStorage.getItem(retryKey) !== "1"
    ) {
      window.sessionStorage.setItem(retryKey, "1");
      reload();
      return new Promise<T>(() => undefined);
    }
    throw error;
  }
}

export function lazyWithReload<T extends ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retryKey: string,
): LazyExoticComponent<T> {
  return lazy(() => importWithSingleReload(importer, retryKey));
}
