const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!backendUrl) {
  throw new Error(
    "Missing EXPO_PUBLIC_BACKEND_URL. Please create a .env file in the root of the project and add EXPO_PUBLIC_BACKEND_URL=https://your-render-url.onrender.com"
  );
}

export const BACKEND_SERVER_URL = backendUrl;