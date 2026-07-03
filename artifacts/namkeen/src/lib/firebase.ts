import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "placeholder_api_key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "placeholder_auth_domain",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "placeholder_project_id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "placeholder_storage_bucket",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "placeholder_messaging_sender_id",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "placeholder_app_id",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
