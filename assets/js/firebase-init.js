import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAAU2aEsIzHudAmEj8wM6v7WsHGwTBSS_Y',
  authDomain: 'goblinassetshop.firebaseapp.com',
  projectId: 'goblinassetshop',
  storageBucket: 'goblinassetshop.firebasestorage.app',
  messagingSenderId: '1050658901839',
  appId: '1:1050658901839:web:83ece81770be76cb94ff3a',
  measurementId: 'G-PVSQ6JB42G',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Set auth persistence to session-based
setPersistence(auth, browserSessionPersistence).catch((error) => {
  console.error('Failed to set session persistence:', error);
});

let authCache = null;
const authPromise = new Promise((resolve) => {
  onAuthStateChanged(auth, (user) => {
    authCache = user;

    const btn = document.querySelector('.btn-getstarted');
      const profileIcon = document.getElementById('profileIcon');
  const cartIcon = document.getElementById('cartIcon');
    if (user) {
      if (btn) {
        btn.textContent = 'Logout';
        btn.href = '#';
        btn.addEventListener('click', handleLogout);
        profileIcon.classList.remove('d-none');
        cartIcon.classList.remove('d-none');
      }
    } else {
      if (btn) {
        btn.textContent = 'Login';
        btn.href = 'login.html';
        profileIcon.classList.add('d-none');
        cartIcon.classList.add('d-none');
      }
    }
    resolve(user);
  });
});

export async function getUser() {
  if (authCache) {
    console.log('returning from cache');
    return authCache;
  }
  console.log('getting from promise');
  return authPromise;
}

async function handleLogout() {
  try {
    await signOut(auth);
    sessionStorage.removeItem('user'); // remove user profile info
  } catch (error) {
    console.error(error);
  }
}
