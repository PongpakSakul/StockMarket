/**
 * Default user UUID for local development.
 * Maps the string 'default-user' (used in request headers) to the actual UUID in PostgreSQL.
 */
export const DEFAULT_USER_UUID = '00000000-0000-0000-0000-000000000001';

/**
 * Resolves a user ID from the request header to a database-compatible user ID.
 * In production, this would come from an auth middleware.
 * For now, maps 'default-user' or any non-UUID to the default UUID.
 */
export function resolveUserId(headerValue: string | undefined): string {
  if (!headerValue || headerValue === 'default-user') {
    return DEFAULT_USER_UUID;
  }
  // If it looks like a UUID, use it directly
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(headerValue)) {
    return headerValue;
  }
  return DEFAULT_USER_UUID;
}
