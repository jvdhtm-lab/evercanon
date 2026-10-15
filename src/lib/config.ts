/**
 * Small, dependency-free helpers for reading required configuration.
 * Kept pure (an explicit `env` map can be injected) so they are easy to unit test.
 */

export function requireEnv(
  name: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const value = env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
