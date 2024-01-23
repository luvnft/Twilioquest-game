import LaunchButton from './LaunchButton';
import VersionChooser from './VersionChooser';

// React hooks used in this component
const { useState } = React;

function LauncherControls(props) {
  const [ status, setStatus ] = useState(`Checking for updates...`);
  const [ channelState, setChannelState ] = useState(null);

  return (
    <div className="LauncherControls">
      <LaunchButton 
        online={ props.online }
        channelState={ channelState }
        onLaunchStatusUpdate={ (e) => setStatus(e.message) }
      />

      <VersionChooser
        online={ props.online }
        onChannelStateUpdated={ (cs) => setChannelState(cs) }
        onError={ (e) => setStatus(e.message) }
      />

      <p className="status">{ status }</p>
    </div>
  );
}

export default LauncherControls;
