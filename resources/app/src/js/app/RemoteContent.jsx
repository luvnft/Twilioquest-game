import querystring from 'querystring';
import config from './config';
import * as versionManager from './version_manager';

const { useState, useEffect } = React;

const { localStorage } = window;
const LS_FIRST_RUN = 'launcherFirstRun';

function RemoteContent(props) {
  const [ newLauncherAvailable, setNewLauncherAvailable ] = useState(false);

  // Check for new launcher version, and take over UI area if one is available
  useEffect(() => {
    (async () => {
      const hasNew = await versionManager.hasNewLauncherVersion();
      setNewLauncherAvailable(hasNew);
    })();
  }, []);

  // Render embedded iframe when online
  function renderOnline() {
    // Prepare query string parameters for iframe
    const firstRun = localStorage.getItem(LS_FIRST_RUN);
    const qs = querystring.stringify({
      ts: new Date().getTime(), // iframe cache buster
      firstRun: firstRun ? 'false' : 'true'
    });

    // Flip the switch on first run
    localStorage.setItem(LS_FIRST_RUN, true);

    return (<iframe 
      src={ `${config.appBaseUrl}${config.launcherUrl}?${qs}` }
      frameBorder="0" height="100%" width="100%">
    </iframe>);
  }

  // Render a prompt to download the latest TQ launcher version
  function renderLauncherPrompt() {
    return (
      <div className="launcherPrompt">
        An important update for the TwilioQuest launcher is required.&nbsp;
        <a href="https://www.twilio.com/quest/download" 
          target="_blank">
          Please download and install it.
        </a>
      </div>
    );
  }

  // When offline, render the TQ logo
  function renderOffline() {
    return(
      <div className="localMessage">
        <img src="img/shield.png" alt="TwilioQuest Shield"/>
        <h2>No Internet Connection</h2>
        <p>
          Go back online to download new TwilioQuest versions or do code 
          challenges that require Internet access.
        </p>
      </div>
    );
  }

  return (
    <div className="RemoteContent">
      { newLauncherAvailable ? renderLauncherPrompt() : '' }
      { props.online ? renderOnline() : renderOffline() }
    </div>
  );
}

export default RemoteContent;
