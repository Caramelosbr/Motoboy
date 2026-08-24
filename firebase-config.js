import { initializeApp }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import { getFirestore }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { getAuth }
  from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBsJV-e_4SCWC5X9TCE_zbLJKnsZMNWMTs",
  authDomain: "motoboys-29310.firebaseapp.com",
  projectId: "motoboys-29310",
  storageBucket: "motoboys-29310.firebasestorage.app",
  messagingSenderId: "1068377303811",
  appId: "1:1068377303811:web:4884b3279f048911c41736"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

window.motoboyFirebase = {
  app,
  db,
  auth
};

window.dispatchEvent(new Event("firebase-ready"));

console.log("Firebase conectado com sucesso.");

export { app, db, auth };