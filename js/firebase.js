
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBc_I890BGvQD4_b-1Djx0vDkxLH6hiys0",
    authDomain: "app-pedidos-a73bf.firebaseapp.com",
    projectId: "app-pedidos-a73bf",
    storageBucket: "app-pedidos-a73bf.firebasestorage.app",
    messagingSenderId: "615368498959",
    appId: "1:615368498959:web:8183329ede0dbbf6f3687a"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);