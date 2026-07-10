import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// App Check attaches a signed attestation to every Firebase Auth/Firestore
// request from this app, which is what actually lets you reject requests
// hitting Firebase's REST API directly (e.g. bypassing the login form's
// Turnstile check) once enforcement is turned on in the Firebase Console —
// see README for the required console setup before enabling enforcement.
// Requires NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY; harmless no-op without it, so
// this doesn't break existing environments that haven't set it up yet.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY) {
  if (process.env.NODE_ENV !== "production") {
    // Lets `next dev` (localhost) pass App Check without a real reCAPTCHA
    // token — register this auto-generated token as a debug token in
    // Firebase Console → App Check → Apps → ⋮ → Manage debug tokens.
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
