import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyAzti1xpHJ-ppUNc4llnsp8301FckyU7Vo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "chatbot-d7c86.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "chatbot-d7c86",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "chatbot-d7c86.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "906537789585",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "1:906537789585:web:f7b674d19367760e427730",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-36JTJ81498",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

let analytics = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((yes) => {
      if (yes) analytics = getAnalytics(app);
    })
    .catch(() => {});
}

export { app, auth, db, googleProvider, analytics };
