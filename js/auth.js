// js/auth.js
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { app } from './firebase.js';

const auth = getAuth(app);

// --- HERRAMIENTA 1: El Guardián ---
export const authGuard = (callback) => {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      callback(user); // Si hay usuario, damos luz verde
    } else {
      // Si no hay usuario y no estamos en login, lo expulsamos
      if (!window.location.pathname.endsWith('login.html')) {
        window.location.href = "login.html";
      }
    }
  });
};

// --- HERRAMIENTA 2: Lógica del Formulario de Login ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorMessageDiv = document.getElementById("error-message");
    errorMessageDiv.classList.add("d-none");
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html"; // Redirigimos al nuevo dashboard
    } catch (error) {
      errorMessageDiv.textContent = "Credenciales incorrectas. Inténtalo de nuevo.";
      errorMessageDiv.classList.remove("d-none");
    }
  });
}

// --- HERRAMIENTA 3: Lógica del Botón de Salida ---
export const setupLogoutButton = () => {
  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await signOut(auth);
        window.location.href = "login.html";
      } catch (error) {
        console.error("Error al cerrar sesión:", error);
      }
    });
  }
};