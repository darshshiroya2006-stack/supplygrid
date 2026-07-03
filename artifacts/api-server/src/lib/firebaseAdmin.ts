import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let isFirebaseAdminInitialized = false;

if (credentialPath) {
  try {
    let credentialsJson;
    try {
      credentialsJson = JSON.parse(credentialPath);
    } catch {
      credentialsJson = credentialPath;
    }

    if (getApps().length === 0) {
      initializeApp({
        credential: cert(credentialsJson),
      });
    }
    isFirebaseAdminInitialized = true;
    console.log("[Firebase Admin] Initialized successfully.");
  } catch (err) {
    console.error("[Firebase Admin] Initialization failed:", err);
  }
} else {
  console.log("[Firebase Admin] GOOGLE_APPLICATION_CREDENTIALS not configured. Running in mock debug fallback mode.");
}

export interface VerifiedFirebaseUser {
  phone?: string;
  email?: string;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!isFirebaseAdminInitialized) {
    console.log("[Firebase Admin - Mock Fallback] Verifying mock token:", idToken);
    if (idToken.startsWith("mock-firebase-token-")) {
      return { phone: idToken.replace("mock-firebase-token-", "") };
    }
    if (idToken.startsWith("mock-firebase-email-")) {
      return { email: idToken.replace("mock-firebase-email-", "") };
    }
    return { phone: "+919999933333", email: "mock@supplygrid.com" };
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    return {
      phone: decodedToken.phone_number,
      email: decodedToken.email,
    };
  } catch (err) {
    console.error("[Firebase Admin] Token verification failed:", err);
    return null;
  }
}
