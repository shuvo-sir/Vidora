const configuredApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const developmentApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL_DEV?.trim();
const legacyBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();
const backendUrl = configuredApiUrl
  || (__DEV__ && developmentApiUrl)
  || (__DEV__ && legacyBackendUrl)
  || (__DEV__ && 'http://10.0.2.2:8000');

if (!backendUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_BASE_URL. Set it to the backend HTTPS URL in your Expo or EAS environment.'
  );
}

export const BACKEND_SERVER_URL = backendUrl.replace(/\/+$/, '');