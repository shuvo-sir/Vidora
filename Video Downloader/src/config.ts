const configuredApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
const developmentApiUrl = process.env.EXPO_PUBLIC_API_BASE_URL_DEV?.trim();
const legacyBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

const HARDCODED_HEROKU_URL = 'https://vidora-backend-shuvix-1d146bc780f5.herokuapp.com';

const backendUrl = configuredApiUrl
  || (!__DEV__ && HARDCODED_HEROKU_URL)
  || (__DEV__ && developmentApiUrl)
  || (__DEV__ && legacyBackendUrl)
  || (__DEV__ && 'http://10.0.2.2:8000');

if (!backendUrl) {
  console.warn('Missing API URL. App may not be able to download.');
}

export const BACKEND_SERVER_URL = (backendUrl || '').replace(/\/+$/, '');