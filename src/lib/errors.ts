//=-- Utility to extract a human-readable message from any error shape

interface TauriError {
  category?: string;
  detail?: string;
  message?: string;
}

//=-- Extract error message from Tauri structured errors (AppError),
//=-- standard Error objects, or plain strings
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
