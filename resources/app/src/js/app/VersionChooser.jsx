import * as versionManager from './version_manager';

const { useState, useEffect, useReducer } = React;

// Handle channel and version selection logic
function channelStateReducer(state, action) {
  if (action.type === 'selectChannel') {
    const nextState = Object.assign({}, state);
    const { channelName, releaseList } = action.payload;

    nextState.releaseList = releaseList;
    nextState.currentRelease = releaseList[0];

    // Select the correct channel
    state.channelList.forEach(c => {
      if (c.name === channelName) {
        nextState.currentChannel = c;
      }
    });

    return nextState;
  } else if (action.type === 'selectVersion') {
    // Select a version
    const nextState = Object.assign({}, state);

    state.releaseList.forEach(r => {
      if (r.id === action.payload) {
        nextState.currentRelease = r;
      }
    });

    return nextState;
  } else if (action.type === 'initialize') {
    const { channelList, releaseList } = action.payload;
    return {
      channelList,
      releaseList,
      currentChannel: channelList[0],
      currentRelease: releaseList[0]
    };
  } else {
    throw new Error('Unrecognized action type');
  }
}

function VersionChooser(props) {
  const [ showAdvanced, setShowAdvanced ] = useState(false);
  const [ channelState, dispatch ] = useReducer(channelStateReducer, null);

  // Bubble up channel state to the parent to share with interested parties
  props.onChannelStateUpdated(channelState);

  // Initialize from version manager
  useEffect(() => {
    (async() => {
      // If we already fetched the channel list, no need to do it again
      if (channelState) { return; }

      try {
        // Get update channel list from server or cache
        const channelList = await versionManager.fetchChannels();
        if (channelList.length < 1) {
          throw new Error(`
            Channel list is empty, which probably means there was wifi, but
            no Internet connection.
          `);
        }

        // Get versions for the default release channel
        const channelName = channelList[0].name;
        const releaseList = await versionManager.fetchReleases(channelName);
        dispatch({
          type: 'initialize', 
          payload: { channelList, releaseList }
        });
      } catch(e) {
        console.log(e);
        props.onError(new Error(
          !props.online ?
          `Can't download initial version list when offline.` :
          `Unable to load TwilioQuest versions :( - relaunch and try again.`
        ));
      }
    })();
  });

  // Helper to select a new channel and update as needed
  async function selectChannel(channelName) {
    try {
      const releaseList = await versionManager.fetchReleases(channelName);
      dispatch({ 
        type: 'selectChannel', 
        payload: { channelName, releaseList }
      });
    } catch(e) {
      console.error(`Unable to fetch releases for channel ${channelName}`);
      dispatch({
        type: 'selectChannel', 
        payload: { channelName, releaseList: [] }
      });
    }
  }

  // Render options for channels
  function renderChannels() {
    if (!channelState || !channelState.channelList) {
      return [<option key="none" value="none">None Available</option>];
    }

    const channelOptions = channelState.channelList.map((c) => {
      return <option key={ c.id } value={ c.name }>
        { c.displayName }
      </option>;
    });
    return channelOptions;
  }

  // Render options for versions
  function renderVersions() {
    if (!channelState || !channelState.releaseList || 
        channelState.releaseList.length < 1) {
      return [<option key="none" value="none">None Available</option>];
    }

    const versionOptions = channelState.releaseList.map((r) => {
      return <option key={ r.id } value={ r.id }>
        { r.name }
      </option>;
    });
    return versionOptions;
  }

  // Render advanced switch option
  function renderAdvancedLink() {
    let versionString = 'None';

    if (props.online && !channelState) {
      versionString = 'Loading...';
    } else if (channelState && channelState.currentRelease) {
      versionString = channelState.currentRelease.name
    }

    return (<div>
      Current Version: { versionString }
      <button className="link" onClick={ () => setShowAdvanced(true) }>
        More &gt;
      </button>
    </div>);
  }

  // Render advanced chooser UI
  function renderAdvanced() {
    return (<div>
      <select value={ channelState ? channelState.currentChannel.name : '' }
        onChange={ e => selectChannel(e.target.value) }>
        { renderChannels() }
      </select>

      <select value={ channelState && channelState.currentRelease ? 
        channelState.currentRelease.id : '' }
        onChange={ (e) => dispatch({
          type: 'selectVersion', 
          payload: e.target.value
        }) }>
        { renderVersions() }
      </select>

      <button className="link" onClick={ () => setShowAdvanced(false) }>
        Hide
      </button>
    </div>);
  }

  return (
    <div className="VersionChooser">
      { showAdvanced ? renderAdvanced() : renderAdvancedLink() }
    </div>
  );
}

export default VersionChooser;
