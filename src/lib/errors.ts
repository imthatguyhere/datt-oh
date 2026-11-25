//=-- Utility to extract a human-readable message from any error shape

/**
 * Shape of the structured error the Rust backend (`AppError`) sends across the Tauri boundary.
 */
interface TauriError {
  category?: string;
  detail?: string;
  message?: string;
}

/**
 * Extracts a human-readable message from any error shape: Tauri `AppError`
 * (`{ category, detail }`), standard `Error`, plain string, or arbitrary object.
 *
 * @param err - The caught value.
 * @returns A message suitable for display.
 */
export function extractErrorMessage(err: unknown): string {
  if (err === null || err === undefined) {
    return "Unknown error";
  }

  if (typeof err === "string") {
    return err;
  }

  if (err instanceof Error) {
    return err.message;
  }

  if (typeof err === "object") {
    const tauriErr = err as TauriError;

    //=-- Tauri AppError: { category: "Config", detail: "..." }
    if (tauriErr.detail) {
      const prefix = tauriErr.category ? `[${tauriErr.category}] ` : "";
      return `${prefix}${tauriErr.detail}`;
    }

    //=-- Generic error with message property
    if (tauriErr.message) {
      return tauriErr.message;
    }

    //=-- Last resort: try JSON
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }

  return String(err);
}
