import config from './config';

// Initialize Firebase connection (firebase is window-scoped)
firebase.initializeApp(config.firebaseConfig);
export const db = firebase.firestore();
export const storage = firebase.storage();
