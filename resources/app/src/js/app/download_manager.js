import EventEmitter from 'events';
import path from 'path';
import { ipcRenderer, remote } from 'electron';
import md5 from 'md5-file/promise';
import tar from 'tar';
import * as jetpack from 'fs-jetpack';
import { storage } from './tq_firebase';
import * as versionManager from './version_manager';

// Get path to app data directory
const appDataPath = path.resolve(remote.app.getPath('appData'), 'TwilioQuest');

// Per platform, downloaded tarballs will have one of three names
let tarballFileName = '';
let tarFileName = '';
switch (process.platform) {
  case 'darwin':
    tarballFileName = 'mac.tgz';
    tarFileName = 'mac.tar';
    break;
  case 'win32':
    tarballFileName = 'windows.tgz';
    tarFileName = 'windows.tar';
    break;
  default:
    tarballFileName = 'linux.tgz';
    tarFileName = 'linux.tar';
    break;
}

// Download manager states
const STATUS = {
  INIT: 'initializing',
  DOWNLOADING: 'downloading',
  VALIDATING: 'validating',
  EXTRACTING: 'extracting',
  OFFLINE: 'offline',
  ERROR: 'error',
  READY: 'ready'
};

// Feedback UI strings
const MESSAGES = {};
MESSAGES[STATUS.INIT] = `Initializing...`;
MESSAGES[STATUS.ERROR] =
  `Error downloading version - restart the launcher to retry.`;
MESSAGES.OFFLINE = `Can't download release version when offline.`;
MESSAGES[STATUS.VALIDATING] = `Validating release...`;
MESSAGES[STATUS.EXTRACTING] = `Getting things ready, one moment...`;
MESSAGES[STATUS.READY] = `TwilioQuest is ready for launch!`;

class DownloadManager extends EventEmitter {
  // Set up from configured channel state
  constructor(channelState) {
    super();
    this.status = STATUS.INIT;
    this.lastStatusUpdate = MESSAGES[STATUS.INIT];
    this.channelState = channelState;

    // Set up necessary information for download from channel/release info
    this.channelName = channelState.currentChannel.name;
    this.releaseName = channelState.currentRelease.name;
    this.releaseId = channelState.currentRelease.id;
    this.checksum = channelState.currentRelease.checksums[tarballFileName];

    // Set up necessary paths to download and extract the requested release
    this.releasesPath = path.resolve(appDataPath, 'releases');
    this.channelPath = path.resolve(this.releasesPath, this.channelName);
    this.releasePath = this.createReleasePath(this.releaseName);

    this.bundlePath = path.resolve(this.releasePath, 'public');
    this.donePath = path.resolve(this.bundlePath, '.done');
    this.htmlPath = path.resolve(this.bundlePath, 'index.html');
    this.tarballFilePath = path.resolve(this.releasePath, tarballFileName);
    this.tarFilePath = path.resolve(this.releasePath, tarFileName);

    // "Stable" is a channel used for blessed builds of master (default in UI)
    const releaseBranch =
      this.channelName === 'stable' ? 'master' : this.channelName;

    // Set up a cloud storage path ref
    this.releaseRef =
      storage.ref(`releases/${releaseBranch}/${this.releaseName}`);

    // Set up IPC event listeners which will monitor for download progress
    // Display progress events
    ipcRenderer.on('downloadProgress', (event, payload) => {
      if (payload.id !== this.releaseId) { return; }

      const p = Math.round(payload.progress * 100);
      this.setStatus(
        STATUS.DOWNLOADING,
        `Downloading ${this.releaseName}... ${p}%`
      );
    });

    // After download is complete, validate and extract package
    ipcRenderer.on('downloadSuccess', (event, payload) => {
      if (payload.id !== this.releaseId) { return; }
      this.validateAndExtract();
    });

    // Respond to download errors
    ipcRenderer.on('downloadError', (event, payload) => {
      if (payload.id !== this.releaseId) { return; }
      console.log(`Error downloading ${this.channelName} ${this.releaseName}:`);
      console.log(payload.error);
      this.setStatus(
        STATUS.ERROR,
        `Couldn't download version ${this.releaseName}`
      );
    });

    // Do an initial download when created
    this.doDownload();
  }

  createReleasePath(releaseName) {
    return this.releasePath = path.resolve(
      this.channelPath,
      releaseName
    );
  }

  // Execute required download steps and send updates as necessary
  /*
    Overall Workflow:
    1.) Check if we've already downloaded the tarball file
    1.5) If not, download tarball
    2.) If version is already extracted, emit ready, if not, extract
    3.) Validate tarball's checksum
    4.) Extract tarball to folder
    5.) Remove old downloaded game versions - if this fails it will not delete new version
    6.) Emit ready event
    7.) TODO: Monitor extracted directory for changes?
  */
  doDownload() {
    (async _ => {
      const tarballExists = await jetpack.existsAsync(this.tarballFilePath);
      if (!tarballExists) {
        // This can only succeed if online
        if (!window.navigator.onLine) {
          return this.setStatus(STATUS.ERROR, MESSAGES.OFFLINE);
        }

        // Download tarball file
        try {
          // Ensure parent directory exists
          await jetpack.dirAsync(this.releasePath);

          // Get goole cloud download link
          const child = this.releaseRef.child(tarballFileName);
          const downloadUrl = await child.getDownloadURL();

          // Use IPC to initiate a download - progress events declared in the
          // constructor will monitor progress
          ipcRenderer.send('downloadFile', {
            url: downloadUrl,
            directory: this.releasePath,
            filename: tarballFileName,
            id: this.releaseId
          });

        } catch (e) {
          console.log(
            `Error downloading ${this.channelName} ${this.releaseName}:`
          );
          console.log(e);
          this.setStatus(
            STATUS.ERROR,
            `Couldn't download version ${this.releaseName}`
          );
        }
      } else {
        // If we already have it, skip to the validation and extraction step
        this.validateAndExtract();
      }
    })();
  }

  // Validate and extract downloaded tarball file
  async validateAndExtract() {
    this.setStatus(STATUS.VALIDATING);

    const failWithError = async (e) => {
      const m = `Couldn't launch ${this.releaseName} (${this.channelName}).`;
      console.log(m, e);
      this.setStatus(STATUS.ERROR, m);

      // If the download couldn't be validated, the release is probably corrupt
      // Remove the release folder so it can be re-created from fresh downloads
      try {
        await jetpack.removeAsync(this.releasePath);
      } catch (e) {
        console.log('Error removing release folder');
        console.log(e);
        this.setStatus(STATUS.ERROR);
      }
    }

    try {
      // Check if the tarball has already been extracted once - if so, bail
      const bundleExists = await jetpack.existsAsync(this.bundlePath);
      const doneFileExists = await jetpack.existsAsync(this.donePath);
      if (bundleExists && doneFileExists) {
        return this.setStatus(STATUS.READY);
      }

      // Sanity check that the tarball file exists
      const exists = await jetpack.existsAsync(this.tarballFilePath);
      if (!exists) {
        throw `tarball package does not exist`;
      }

      // generate hash from downloaded tarball, and compare from server-fetched
      // checksum
      const hash = await md5(this.tarballFilePath);
      console.log(`Checksum for ${tarballFileName}:`, hash);
      if (hash !== this.checksum) {
        throw `Checksum from server and downloaded package don't match.`;
      }

      // Update user-facing status
      this.setStatus(STATUS.EXTRACTING);

      // Ensure previous bundle folder does not exist, then recreate
      await jetpack.removeAsync(this.bundlePath);
      await jetpack.dirAsync(this.bundlePath);

      // use tar to extract
      let fileNo = 0, fileTotal = 0;

      // Get number of file entries
      await tar.t({
        file: this.tarballFilePath,
        cwd: this.releasePath,
        onentry: _ => fileTotal++
      });

      // Extract files
      await tar.x({
        file: this.tarballFilePath,
        cwd: this.releasePath,
        onentry: entry => 
          this.setStatus(STATUS.EXTRACTING, 
            `Extracting: ${Math.floor((fileNo++/fileTotal) * 100)}%`)
      });

      // Remove old versions after new version successfully downloads to 
      // not interfere with critical path.
      await this.removeOldVersions();

      // Write a file to the filesystem indicating the package has been
      // extracted successfully
      await jetpack.writeAsync(this.donePath, 'extraction completed!');

      // If we got to this point, we're gtg!
      this.setStatus(STATUS.READY);
    } catch (e) {
      failWithError(e);
    }
  }

  async removeOldVersions() {
    const releaseDirExists = await jetpack.existsAsync(this.channelPath);

    if (!releaseDirExists) {
      this.logError('Release directory does not exist!');
      return;
    }

    let localReleaseNames;

    try {
      localReleaseNames = await jetpack.listAsync(this.channelPath);
    } catch (err) {
      this.logError('Error listing old downloaded versions!', err);
      return;
    }

    let remoteReleaseNames;

    try {
      const remoteReleases = await versionManager.fetchReleases(this.channelName);
      remoteReleaseNames = remoteReleases.map(release => release.name);
    } catch (err) {
      this.logError('Error accessing remote version list!', err);
      return;
    }

    const isLocalReleaseOnRemote = localName => !remoteReleaseNames.includes(localName);
    const oldReleases = localReleaseNames.filter(isLocalReleaseOnRemote);

    try {
      const removeOldReleasePromises = oldReleases.map(oldRelease => jetpack.removeAsync(this.createReleasePath(oldRelease)));

      await Promise.all(removeOldReleasePromises);
    } catch (err) {
      this.logError('Error removing old verions', err);
      return;
    }
  }

  logError(message, error) {
    if (message) {
      console.log(message);
    }

    if (error) {
      console.log(error);
    }

    this.setStatus(STATUS.ERROR);
  }

  // Set a new status and emit an update
  setStatus(type, message) {
    this.status = type;
    this.lastStatusUpdate = message || MESSAGES[type];
    this.emit('statusChange', {
      type: type,
      message: this.lastStatusUpdate
    });
  }
}

export default DownloadManager;
