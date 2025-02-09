// Import the necessary functions from the Firebase SDK
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD2p793aEoriJb3VNZsxIBiuftPfmWYq7Q",
  authDomain: "sacred-store-30539.firebaseapp.com",
  projectId: "sacred-store-30539",
  storageBucket: "sacred-store-30539.firebasestorage.app",
  messagingSenderId: "1052564864440",
  appId: "1:1052564864440:web:c4cf18b80c16e4cbe7e34d",
  measurementId: "G-ER5LXP7BMZ"
};

const firebaseApp = initializeApp(firebaseConfig);

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export { db, auth };
