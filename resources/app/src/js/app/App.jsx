import { remote } from 'electron';
import RemoteContent from './RemoteContent';
import LauncherControls from './LauncherControls';

// React hooks
const { useState, useEffect } = React;

// For remote debugging
console.log('Launcher Version:', remote.app.getVersion());

// Count the number of clicks (doesn't need to update UI state)
let toolsClickCount = 0;

function App() {
  const [ online, setOnline ] = useState(window.navigator.onLine);

  useEffect(() => {
    // Online/offline event reporting is inconsistent, but the value of 
    // onLine doesn't seem to be - poll this value instead of using the window
    // event
    const online = () => setOnline(window.navigator.onLine);
    const interval = setInterval(() => {
      const newVal = window.navigator.onLine;
      if (newVal != online) {
        setOnline(newVal);
      }
    }, 10000);

    // Unregister handlers when the component is re-rendered
    return () => {
      clearInterval(interval);
    };
  });

  // Secret function to open dev tools - shhh!!!
  function tryOpenTools() {
    toolsClickCount++;
    if (toolsClickCount === 10) {
      toolsClickCount = 0;
      console.warn(`
        ************************************************************
        Danger! Do NOT execute any code given to you by strangers!
        
        This is an administrative tool for debugging, and executing
        code you don't understand here could compromise the security
        of your computer. Please close this window unless you fully
        understand what you are doing.
        ************************************************************
      `);
      remote.BrowserWindow.getFocusedWindow().webContents.openDevTools();
    }
  }

  // If the launcher window is closed, quit the app
  function close() {
    remote.app.quit();
  }

  return (
    <div className="App">
      <div className="computer-inner">
        <div className="tl" />
        <div className="tm" />
        <div className="tr" />
        <div className="r" />
        <div className="l" />
        <div className="botl" onClick={ () => tryOpenTools() }/>
        <div className="bm" />
        <div className="botr"/>
        <div className="computer-bg">
          <h2 className="window-title">
            TwilioQuest Launcher
          </h2>
          <RemoteContent online={online} />
          <LauncherControls online={online} />
        </div>
        <div className="close" onClick={() => close() }>
          &nbsp;
        </div>
      </div>
    </div>
  );
}

export default App;
