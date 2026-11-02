// Shared retry policy: network errors and 5xx are retried with backoff; 4xx never are.
import { ApiError } from "./client";

const MAX_RETRIES = 3;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  const clientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  return failureCount < MAX_RETRIES && !clientError;
}

// Exponential backoff with jitter; attempt starts at 0.
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000) * (0.5 + Math.random() / 2);
}

// For calls made outside useQuery/useMutation, so they follow the same policy.
export async function withRetry<T>(run: () => Promise<T>, delay: (attempt: number) => number = retryDelay): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!shouldRetry(attempt, error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay(attempt)));
    }
  }
}
