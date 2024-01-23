import DownloadManager from './download_manager';
const { BrowserWindow, getCurrentWindow } = require('electron').remote;

// React hooks
const { useState, useEffect } = React;

// Maintain in-memory references to download managers for different release
// versions
const dlManagers = {};

function LaunchButton(props) {
  const [ canLaunch, setCanLaunch ] = useState(false);
  const [ showRetry, setShowRetry ] = useState(false);

  // Internal helper to get current download manager for selected release
  // (can be null)
  function getCurrentDownloadManager() {
    if (props.channelState && props.channelState.currentRelease) {
      const releaseId = props.channelState.currentRelease.id;
      return dlManagers[releaseId];
    } else {
      return null;
    }
  }

  // Execute async setup in the side-effect inducing hook
  useEffect(() => {
    // if we haven't received channel state, we can't initialize
    if (!props.channelState) {
      return;
    }

    // If current release is null, it could be a condition where a channel has
    // no current releases (like release candidates)
    if (!props.channelState.currentRelease) {
      props.onLaunchStatusUpdate({
        type: 'error',
        message: `No releases available.`
      });
      setCanLaunch(false);
      setShowRetry(false);
      return;
    }

    // Check if a download manager has been created for the given release ID
    // Create one if necessary
    const releaseId = props.channelState.currentRelease.id;
    let dm = dlManagers[releaseId];
    if (!dm) {
      dm = new DownloadManager(props.channelState);
      dlManagers[releaseId] = dm;
      console.log(`Download manager for ${releaseId} created.`);
    }

    // Update launch UI with current download state
    props.onLaunchStatusUpdate({
      type: dm.status,
      message: dm.lastStatusUpdate
    });

    // If the download manager is already in a ready state, we can launch
    // Otherwise, we need to initiate a download/validate process
    switch (dm.status) {
      case 'ready': 
        setCanLaunch(true);
        setShowRetry(false);
        break;
      case 'error':
        // Enable a retry option in the UI
        setCanLaunch(false);
        setShowRetry(true);
        break;
      default: 
        // no-op - all other states indicate a download/validation is already
        // in progress or has failed
        break;
    }

    // Handler function to react to download status
    function handleDownloadStatus(e) {
      // The ready event indicates the selected game version is ready to launch
      setCanLaunch(e.type === 'ready');
      // Send status message back up to parent
      props.onLaunchStatusUpdate(e);
    }
    dm.on('statusChange', handleDownloadStatus);

    // Remove subscription for cleanup
    return function cleanup() {
      dm.removeListener('statusChange', handleDownloadStatus);
    };
  });

  // Launch the selected version, if possible
  function launch() {
    // Shouldn't happen, but bail if launch status is not okay
    if (!canLaunch) { return; }

    // Create and manage an electron browser window with the unzipped game
    const dm = getCurrentDownloadManager();

    // Launch new browser window
    const bw = new BrowserWindow({
      title: 'TwilioQuest',
      backgroundColor: '#232323',
      height: 800,
      width: 1280,
      minWidth: 1024,
      minHeight: 576,
      show: false,
      webPreferences: {
        nodeIntegration: true
      }
    });
    bw.loadFile(dm.htmlPath);

    // Wait a bit, then close the launcher window - note to future explorers -
    // I did try and use window events for this (like ready-to-show and others)
    // but they were never fired. Maybe one day you will succeed where I have
    // failed!
    setTimeout(() => {
      bw.show();
      setTimeout(() => {
        getCurrentWindow().close();
      }, 1000);
    }, 500);
  }

  // Kick off a download retry for the current download manager
  function retryDownload() {
    const dm = getCurrentDownloadManager();
    dm.doDownload();
  }

  return (
    <div className="LaunchButton">
      <button className="bigButton" disabled={ !canLaunch }
        onClick={ launch }>
        { props.online ? 'PLAY TWILIOQUEST' : 'PLAY OFFLINE' }
      </button>
      { showRetry && props.online ? 
        <button className="link" onClick={ retryDownload }>
          Retry Download
        </button>
        : ''
      }
    </div>
  );
}

export default LaunchButton;
