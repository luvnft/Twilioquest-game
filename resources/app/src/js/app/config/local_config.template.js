export default {
  appBaseUrl: 'https://twilioquest-dev.firebaseapp.com/quest/next',

  // Firebase config for production - since this is the non-admin SDK intended 
  // for use in browser JS applications, it is safe to store configuration in 
  // version control.
  firebaseConfig: {
    apiKey: 'AIzaSyC2K-GdtU3bLQ-KsBVh_pHQW4GaFWQekcU',
    authDomain: 'twilioquest-dev.firebaseapp.com',
    databaseURL: 'https://twilioquest-dev.firebaseio.com',
    projectId: 'twilioquest-dev',
    storageBucket: 'twilioquest-dev.appspot.com',
    messagingSenderId: '64086769119'
  }
};
