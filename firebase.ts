// firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyATNNo3QQSirMHPMvkmRR2uNxTk7dmQOM4",
  authDomain: "house-expense-9f288.firebaseapp.com",
  projectId: "house-expense-9f288",
  storageBucket: "house-expense-9f288.firebasestorage.app",
  messagingSenderId: "1041577908387",
  appId: "1:1041577908387:web:b6083d2323912fb414c716",
  measurementId: "G-CSM4731T6E"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

export { app };