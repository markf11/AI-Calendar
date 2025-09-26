// Test setup file for desktop application tests

// Mock electron modules globally
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    quit: jest.fn(),
    getVersion: jest.fn(() => '1.0.0'),
    setLoginItemSettings: jest.fn(),
    isQuiting: false
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    close: jest.fn(),
    minimize: jest.fn(),
    restore: jest.fn(),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    setFullScreen: jest.fn(),
    isVisible: jest.fn(() => true),
    isFocused: jest.fn(() => true),
    isMinimized: jest.fn(() => false),
    isMaximized: jest.fn(() => false),
    isFullScreen: jest.fn(() => false),
    getBounds: jest.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
    setBounds: jest.fn(),
    setPosition: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn()
    }
  })),
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip: jest.fn(),
    setImage: jest.fn(),
    on: jest.fn(),
    popUpContextMenu: jest.fn(),
    destroy: jest.fn()
  })),
  Menu: {
    buildFromTemplate: jest.fn(() => ({}))
  },
  MenuItem: jest.fn().mockImplementation((options) => options),
  globalShortcut: {
    register: jest.fn(() => true),
    unregister: jest.fn(),
    unregisterAll: jest.fn(),
    isRegistered: jest.fn(() => false)
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  shell: {
    openExternal: jest.fn()
  },
  dialog: {
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 }))
  },
  screen: {
    getPrimaryDisplay: jest.fn(() => ({
      workAreaSize: { width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1080 }
    })),
    getAllDisplays: jest.fn(() => [
      {
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      }
    ]),
    on: jest.fn()
  },
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  })),
  nativeImage: {
    createFromPath: jest.fn()
  },
  contextBridge: {
    exposeInMainWorld: jest.fn()
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }
}));

// Mock electron-store
jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key, defaultValue) => defaultValue),
    set: jest.fn(),
    clear: jest.fn(),
    store: {}
  }));
});

// Mock node-notifier
jest.mock('node-notifier', () => ({
  notify: jest.fn()
}));

// Mock electron-updater
jest.mock('electron-updater', () => ({
  autoUpdater: {
    checkForUpdatesAndNotify: jest.fn(),
    quitAndInstall: jest.fn(),
    on: jest.fn()
  }
}));

// Mock fs and path modules
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn()
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
  basename: jest.fn((path) => path.split('/').pop())
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1 // OPEN
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve('')
  })
) as jest.Mock;

// Mock navigator.onLine
Object.defineProperty(window.navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window.addEventListener for online/offline events
const originalAddEventListener = window.addEventListener;
window.addEventListener = jest.fn((event, handler) => {
  if (event === 'online' || event === 'offline') {
    // Store handlers for manual triggering in tests if needed
    return;
  }
  return originalAddEventListener.call(window, event, handler);
});

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

console.error = jest.fn();
console.warn = jest.fn();
console.log = jest.fn();

// Restore console methods after tests if needed
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Set up test environment variables
process.env.NODE_ENV = 'test';