import { ApiError, staffJson } from "@/lib/api/staff-client";

export async function staffOptionalForbidden<T>(path: string): Promise<T | null> {
  try {
    return await staffJson<T>(path);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}
