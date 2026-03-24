// Type-safe environment variable access
const getEnvVar = (key: string, fallback?: string): string => {
  const value = import.meta.env[key] ?? fallback;
  if (value === undefined) {
    console.warn(`[env] Missing environment variable: ${key}`);
    return '';
  }
  return value;
};

export const env = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  APP_ENV: import.meta.env.VITE_API_ENV,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;
