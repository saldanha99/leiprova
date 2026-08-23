import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined) {
  const path = typeof value === "string" ? value : "";
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(path)
  ) {
    return "/app";
  }

  const internalOrigin = "https://leiprova.invalid";

  try {
    const target = new URL(path, internalOrigin);
    if (target.origin !== internalOrigin) return "/app";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/app";
  }
}
