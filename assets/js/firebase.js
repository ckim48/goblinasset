import { GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { auth, db, getUser } from './firebase-init.js';


/**
 * Sign-in user with Google popup & persists authentication status in browser session
 * If user document doesn't exist in Firestore, create new doc
 * @returns user document object
 */
export function signInWithGoogle(formData) {
  const googleProvider = new GoogleAuthProvider();
  return signInWithPopup(auth, googleProvider)
    .then(async (result) => {
      const user = result.user;
      console.log('User signed in with Google: ', user);

      // Check if user document exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        const { username, age, gender, country, about } = formData;
        await setDoc(userDocRef, {
          username,
          age,
          gender,
          country,
          about,
          name: user.displayName,
          email: user.email,
          createdAt: serverTimestamp(),
          assets: [],
        });
        console.log('New user document created in Firestore');
      } else {
        console.log('User document already exists in Firestore');
      }

      return user;
    })
    .catch((error) => {
      console.error('Error during Google sign-in: ', error.message);
      throw error;
    });
}

/**
 *
 * @param {*} productIds string | string[]
 */
export async function checkoutCart(productIds) {
  // TODO: link to payment
  const user = await getUser();

  if (!user) {
    throw new Error('No user is signed in');
  }

  const purchased_at = Date.now();

  if (Array.isArray(productIds)) {
    for (const productId of productIds) {
      const product = await getProduct(productId);
      if (product.available && !product.purchased_at) {
        await updateProduct(productId, { available: false, purchased_at });
        await updateUserProfile({
          assets: arrayUnion({ productId, purchased_at, status: 'Purchased' }),
        });
      } else {
        console.error(`${productId} is not for-sale. Skipping update...`);
        throw new Error('Item not for sale');
      }
    }
  } else {
    await updateProduct(productIds, { available: false, purchased_at });
    await updateUserProfile({
      assets: arrayUnion({ productId: productIds, purchased_at, status: 'Purchased' }),
    });
  }

  console.log('Finished checkout cart & updated in Firestore');
}

/**
 * Update user's shopping cart - Add / Remove
 * @param {*} productId string
 * @throws Error if not `auth.currentUser` found
 */
export async function updateCart(productId) {
  try {
    const user = await getUser();

    if (!user) {
      throw new Error('No user is signed in');
    }

    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const cart = userDocSnap.data().cart;

      if (cart.includes(productId)) {
        await updateDoc(userDocRef, {
          cart: arrayRemove(productId),
        });
      } else {
        await updateDoc(userDocRef, {
          cart: arrayUnion(productId),
        });
      }
    }
  } catch (error) {
    console.error('Failed to update user cart:', error);
    throw error;
  }
}

/**
 *
 * @returns user document object
 * @throws Error if not `auth.currentUser` found
 */
export async function getUserProfile() {
  try {
    const user = await getUser();
    const userCache = JSON.parse(sessionStorage.getItem('user')) || null;

    if (userCache) {
      return userCache;
    }

    if (!user) {
      throw new Error('No user is signed in');
    }

    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      sessionStorage.setItem('user', JSON.stringify(userDocSnap.data()));
      return userDocSnap.data();
    }
  } catch (error) {
    console.error('Failed to get user doc: ', error);
  }
}

/**
 *
 * @param {*} details object of fields to be updated
 */
export async function updateUserProfile(details) {
  try {
    const user = await getUser();

    if (!user) {
      throw new Error('No user is signed in');
    }

    const userDocRef = doc(db, 'users', user.uid);

    await updateDoc(userDocRef, details);
    const updatedUserDocSnap = await getDoc(userDocRef);
    let userCache = JSON.parse(sessionStorage.getItem('user')) || null;
    if (userCache) {
      sessionStorage.setItem('user', JSON.stringify(updatedUserDocSnap.data()));
    }
    console.log('User doc updated on Firestore');
  } catch (error) {
    console.error('Failed to update user profile: ', error);
    throw error;
  }
}
document.addEventListener('DOMContentLoaded', async () => {
  const user = await getUser(); 

  const profileIcon = document.getElementById('profileIcon');
  const cartIcon = document.getElementById('cartIcon');

  if (user) {
    profileIcon.classList.remove('d-none');
    cartIcon.classList.remove('d-none');
  } else {
    profileIcon.classList.add('d-none');
    cartIcon.classList.add('d-none');
  }
});

/**
 *
 * @returns array of product document objects
 */
export async function getProducts() {
  let products = [];
  try {
    const querySnapshot = await getDocs(collection(db, 'products'));
    querySnapshot.forEach((doc) => {
      products.push({
        ...doc.data(),
        productId: doc.id,
      });
    });

    return products;
  } catch (error) {
    console.error('Failed to get products: ', error);
    throw error;
  }
}

/**
 * @param {*} productId string
 * @returns product document object
 */
export async function getProduct(productId) {
  try {
    const productDocRef = doc(db, 'products', productId);
    const productDocSnap = await getDoc(productDocRef);

    if (productDocSnap.exists()) {
      return productDocSnap.data();
    }
  } catch (error) {
    console.error('Failed to get product: ', error);
    throw error;
  }
}

/**
 * (Admin Only)
 * @param {*} product
 *  {
 *    name: string;
 *    price: number;
 *    desc: string;
 *    spec: {
 *      job: string;
 *      style: string[] | string;
 *      type: string[] | string;
 *    }
 *    filter: string;
 *    img: string | null;
 *    available: boolean;
 *  }
 */
export async function addProduct(product) {
  try {
    const productsCollection = collection(db, 'products');
    const productDocRef = await addDoc(productsCollection, product);
    console.log(`New product added for ${productDocRef.id}`);
  } catch (error) {
    console.error('Failed to add new product: ', error);
    throw error;
  }
}

/**
 * (Admin Only)
 * @param {*} productId string
 * @param {*} details object of fields to be updated
 *  {
 *    name?: string;
 *    price?: number;
 *    desc?: string;
 *    spec?: {
 *      job?: string;
 *      style?: string[] | string;
 *      type?: string[] | string;
 *    }
 *    filter: string;
 *    img?: string | null;
 *    available?: boolean;
 *    purchased_at?: Date;
 *  }
 */
export async function updateProduct(productId, details) {
  try {
    const productDocRef = doc(db, 'products', productId);
    await updateDoc(productDocRef, details);
    console.log(`Product updated for ${productId}`);
  } catch (error) {
    console.error('Failed to update product:', error);
    throw error;
  }
}

/**
 * (Admin Only)
 * @param {*} productId string
 */
export async function deleteProduct(productId) {
  try {
    const productDocRef = doc(db, 'products', productId);
    await deleteDoc(productDocRef);
    console.log(`Product deleted for ${productId}`);
  } catch (error) {
    console.error('Failed to delete product: ', error);
    throw error;
  }
}
