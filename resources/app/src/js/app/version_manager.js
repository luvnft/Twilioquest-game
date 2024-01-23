import { db } from './tq_firebase';
const { app } = require('electron').remote;

const { localStorage } = window;
const LS_CHANNELS = 'releaseChannels';

// Check if there is a newer version of the launcher application available
export async function hasNewLauncherVersion() {
  const version = app.getVersion().split('.')[0];
  const doc = await db.collection('launcherVersion').doc('latest').get();
  const latest = doc.data().version;
  return version !== latest;
}

export function fetchChannels() {
  async function doFetch(resolve, reject) {
    try {
      // When offline, try to load the channel list from localStorage
      if (!window.navigator.onLine) {
        const channelJson = localStorage.getItem(LS_CHANNELS);
        if (channelJson) {
          const channelList = JSON.parse(channelJson);
          return resolve(channelList);
        } else {
          return reject(new Error(`No offline channel list available.`));
        }
      }

      // Grab latest channel list from Firebase
      const channelList = [];
      const snapshot = await db.collection('releaseChannels')
        .orderBy('priority')
        .get();
      
      snapshot.forEach(doc => {
        const docData = doc.data();
        docData.id = doc.id;
        channelList.push(docData);
      });

      // Store the most recent result in localStorage to use as a fallback
      // when offline, IFF we successfully actually got something from
      // Firebase
      if (channelList && channelList.length > 0) {
        localStorage.setItem(LS_CHANNELS, JSON.stringify(channelList));
      }
      resolve(channelList);
    } catch(e) {
      console.log(`Error fetching channel list`, e);
      reject(e);
    }
  }

  return new Promise((resolve, reject) => {
    doFetch(resolve, reject);
  });
}

export function fetchReleases(channelName) {
  async function doFetch(resolve, reject) {
    try {
      const LS_RELEASE = `releases-${channelName}`;

      // When offline, try to load the release list from localStorage
      if (!window.navigator.onLine) {
        const releaseJson = localStorage.getItem(LS_RELEASE);
        if (releaseJson) {
          const releasesData = JSON.parse(releaseJson);
          return resolve(releasesData);
        } else {
          return reject(new Error(`No offline release list available.`));
        }
      }

      // Grab the last several releases 
      const releaseList = [];
      const snapshot = await db.collection('releases')
        .where('channelName', '==', channelName)
        .orderBy('createdAt', 'desc')
        .orderBy('name', 'desc')
        .get();
      
      snapshot.forEach(doc => {
        // Massage release data into the format we want
        const docData = {
          id: doc.id,
          createdAt: doc.get('createdAt').toDate(),
          name: doc.get('name'),
          checksums: doc.get('checksums'),
          channelName
        };
        releaseList.push(docData);
      });

      // Store the most recent result in localStorage to use as a fallback
      // when offline, IFF we successfully actually got something from
      // Firebase
      if (releaseList && releaseList.length > 0) {
        localStorage.setItem(LS_RELEASE, JSON.stringify(releaseList));
      }
      resolve(releaseList);
    } catch(e) {
      console.log(`Error fetching release list`, e);
      reject(e);
    }
  }

  return new Promise((resolve, reject) => {
    doFetch(resolve, reject);
  });
}
