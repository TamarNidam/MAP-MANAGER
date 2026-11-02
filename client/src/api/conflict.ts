import { ApiError } from "./client";

export const CONFLICT_MESSAGE =
  "This item was changed by someone else. The latest version was loaded; your edits are still shown, so review them and save again.";

// On 409, refetch the item and throw a friendly error; the details card keeps the user's unsaved fields.
export async function rethrowConflict(error: unknown, refetch: () => Promise<unknown>): Promise<never> {
  if (error instanceof ApiError && error.status === 409) {
    await refetch().catch(() => undefined);
    throw new Error(CONFLICT_MESSAGE);
  }
  throw error;
}
