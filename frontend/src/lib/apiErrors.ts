export class ApiConnectionError extends Error {
  path?: string;

  constructor(path?: string) {
    super("Backend connection unavailable. Showing demo data where available.");
    this.name = "ApiConnectionError";
    this.path = path;
  }
}

export function isGlobalApiError(error: unknown): boolean {
  if (error instanceof ApiConnectionError) return true;
  if (!(error instanceof Error)) return false;

  return error.message.includes("Backend connection unavailable")
    || error.message.includes("Failed to fetch");
}

export function safeApiMessage(error: unknown): string {
  if (error instanceof ApiConnectionError) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    if (error.message.includes("Backend connection unavailable")) {
      return "Backend connection unavailable. Showing demo data where available.";
    }
    return error.message;
  }
  return "Unable to load this clinical operations view.";
}
