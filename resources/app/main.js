const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const { download } = require('electron-dl');
const isDev = require('electron-is-dev');

// Configure a bare-bones right click context menu
require('electron-context-menu')();

// Reference to main launcher window
let launcherWindow;

// Capture navigation events and open in system default browser
function handleRedirect(e, url) {
  if(url != launcherWindow.webContents.getURL()) {
    e.preventDefault();
    shell.openExternal(url);
  }
}

// Menu options
const template = [
  {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteandmatchstyle' },
      { role: 'delete' },
      { role: 'selectall' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' }
    ]
  },
  {
    role: 'window',
    submenu: [
      { role: 'minimize' },
      { role: 'close' }
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'TwilioQuest Help',
        click () { 
          require('electron').shell.openExternal('https://www.twilio.com/quest'); 
        }
      }
    ]
  }
];

if (process.platform === 'darwin') {
  template.unshift({
    label: app.getName(),
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  });

  // Edit menu
  template[1].submenu.push(
    { type: 'separator' },
    {
      label: 'Speech',
      submenu: [
        { role: 'startspeaking' },
        { role: 'stopspeaking' }
      ]
    }
  );

  // Window menu
  template[3].submenu = [
    { role: 'close' },
    { role: 'minimize' },
    { role: 'zoom' },
    { type: 'separator' },
    { role: 'front' }
  ];
}

function createWindow() {
  if (isDev) {
    // Install React dev tools on launch in dev
    const {
      default: installExtension,
      REACT_DEVELOPER_TOOLS
    } = require('electron-devtools-installer');

    installExtension(REACT_DEVELOPER_TOOLS).then(name => {
      console.log(`Added Extension: ${name}`);
    }).catch(err => {
      console.log('An error occurred: ', err);
    });

    // Add reload option to menu
    template.forEach(tpl => {
      if (tpl.label === 'View') {
        tpl.submenu.push({ 
          label: 'Reload', 
          accelerator: "CmdOrCtrl+R", 
          click() {
            launcherWindow && launcherWindow.reload();
          }
        });
      }
    });
  }

  const menu = Menu.buildFromTemplate(template);

  launcherWindow = new BrowserWindow({ 
    width: 720,
    minWidth: 700,
    height: 800,
    minHeight: 550,
    backgroundColor: process.platform === 'linux' ? '#000000' : null,
    frame: false,
    transparent: process.platform === 'linux' ? false : true,
    show: false,
    titleBarStyle: 'customButtonsOnHover',
    webPreferences: {
      nodeIntegration: true
    }
  });
  launcherWindow.loadFile('public/index.html');

  launcherWindow.once('ready-to-show', () => {
    launcherWindow.show();
  });
  
  // Dereference the window after close
  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });

  // Set up application menu options
  Menu.setApplicationMenu(menu);

  // Open links in system default browser
  launcherWindow.webContents.on('will-navigate', handleRedirect);
  launcherWindow.webContents.on('new-window', handleRedirect);

  // Set up file download handler
  ipcMain.on('downloadFile', (event, payload) => {
    download(launcherWindow, payload.url, {
      directory: payload.directory,
      filename: payload.filename,
      onProgress(p) {
        launcherWindow.webContents.send('downloadProgress', {
          id: payload.id,
          progress: p
        });
      }
    }).then(dlItem => {
      launcherWindow.webContents.send('downloadSuccess', {
        id: payload.id,
        dlItem
      });
    }).catch(error => {
      launcherWindow.webContents.send('downloadError', {
        id: payload.id,
        error
      });
    });
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  app.quit();
});
