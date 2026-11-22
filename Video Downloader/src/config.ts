export const BACKEND_SERVER_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  // Replace this fallback with the deployed Render HTTPS URL for mobile data access.
  'http://192.168.0.218:8000';