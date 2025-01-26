// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD2p793aEoriJb3VNZsxIBiuftPfmWYq7Q",
  authDomain: "sacred-store-30539.firebaseapp.com",
  projectId: "sacred-store-30539",
  storageBucket: "sacred-store-30539.firebasestorage.app",
  messagingSenderId: "1052564864440",
  appId: "1:1052564864440:web:c4cf18b80c16e4cbe7e34d",
  measurementId: "G-ER5LXP7BMZ",
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Export Firebase Auth
export const auth = getAuth(firebaseApp);
