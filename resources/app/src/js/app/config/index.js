import isDev from 'electron-is-dev';

// Default configuration
let config = {
  appBaseUrl: 'https://twilioquest-prod.firebaseapp.com/quest/next',
  launcherUrl: '/launcher',

  // Firebase config for production - since this is the non-admin SDK intended 
  // for use in browser JS applications, it is safe to store configuration in 
  // version control.
  firebaseConfig: {
    apiKey: 'AIzaSyDI5g9d6XTQtUWT6tPqFNJf171sQ08N-ZA',
    authDomain: 'twilioquest-prod.firebaseapp.com',
    databaseURL: 'https://twilioquest-prod.firebaseio.com',
    projectId: 'twilioquest-prod',
    storageBucket: 'twilioquest-prod.appspot.com',
    messagingSenderId: '397868221836'
  }
};

// Attempt to load local config in the dev environment, if present
if (isDev) {
  try {
    const localConfig = require('./local_config').default;
    config = Object.assign(config, localConfig);
  } catch(e) {
    console.log('Error loading local config:');
    console.log(e);
  }
}

export default config;
