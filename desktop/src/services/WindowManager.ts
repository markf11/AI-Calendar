import { BrowserWindow, screen } from 'electron';

export interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean;
  isFullScreen: boolean;
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private windowState: WindowState | null = null;

  public setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    this.setupWindowEventHandlers();
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public saveWindowState(): WindowState | null {
    if (!this.mainWindow) return null;

    const bounds = this.mainWindow.getBounds();
    const isMaximized = this.mainWindow.isMaximized();
    const isFullScreen = this.mainWindow.isFullScreen();

    this.windowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized,
      isFullScreen
    };

    return this.windowState;
  }

  public restoreWindowState(state: WindowState): void {
    if (!this.mainWindow) return;

    // Validate that the window position is within screen bounds
    const validatedState = this.validateWindowState(state);

    this.mainWindow.setBounds({
      x: validatedState.x,
      y: validatedState.y,
      width: validatedState.width,
      height: validatedState.height
    });

    if (validatedState.isMaximized) {
      this.mainWindow.maximize();
    }

    if (validatedState.isFullScreen) {
      this.mainWindow.setFullScreen(true);
    }
  }

  public centerWindow(): void {
    if (!this.mainWindow) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const bounds = this.mainWindow.getBounds();

    const x = Math.round((screenWidth - bounds.width) / 2);
    const y = Math.round((screenHeight - bounds.height) / 2);

    this.mainWindow.setPosition(x, y);
  }

  public ensureWindowVisible(): void {
    if (!this.mainWindow) return;

    const bounds = this.mainWindow.getBounds();
    const displays = screen.getAllDisplays();
    
    // Check if window is visible on any display
    const isVisible = displays.some(display => {
      const { x, y, width, height } = display.workArea;
      return bounds.x >= x && bounds.y >= y && 
             bounds.x + bounds.width <= x + width && 
             bounds.y + bounds.height <= y + height;
    });

    if (!isVisible) {
      this.centerWindow();
    }
  }

  public toggleMaximize(): void {
    if (!this.mainWindow) return;

    if (this.mainWindow.isMaximized()) {
      this.mainWindow.unmaximize();
    } else {
      this.mainWindow.maximize();
    }
  }

  public toggleFullScreen(): void {
    if (!this.mainWindow) return;

    const isFullScreen = this.mainWindow.isFullScreen();
    this.mainWindow.setFullScreen(!isFullScreen);
  }

  public minimize(): void {
    if (!this.mainWindow) return;
    this.mainWindow.minimize();
  }

  public close(): void {
    if (!this.mainWindow) return;
    this.mainWindow.close();
  }

  public focus(): void {
    if (!this.mainWindow) return;
    
    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    
    this.mainWindow.show();
    this.mainWindow.focus();
  }

  public hide(): void {
    if (!this.mainWindow) return;
    this.mainWindow.hide();
  }

  public isVisible(): boolean {
    return this.mainWindow?.isVisible() ?? false;
  }

  public isFocused(): boolean {
    return this.mainWindow?.isFocused() ?? false;
  }

  public isMinimized(): boolean {
    return this.mainWindow?.isMinimized() ?? false;
  }

  public isMaximized(): boolean {
    return this.mainWindow?.isMaximized() ?? false;
  }

  public isFullScreen(): boolean {
    return this.mainWindow?.isFullScreen() ?? false;
  }

  private setupWindowEventHandlers(): void {
    if (!this.mainWindow) return;

    // Save window state on changes
    this.mainWindow.on('resize', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('move', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('maximize', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('unmaximize', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('enter-full-screen', () => {
      this.saveWindowState();
    });

    this.mainWindow.on('leave-full-screen', () => {
      this.saveWindowState();
    });

    // Handle display changes
    screen.on('display-added', () => {
      this.ensureWindowVisible();
    });

    screen.on('display-removed', () => {
      this.ensureWindowVisible();
    });

    screen.on('display-metrics-changed', () => {
      this.ensureWindowVisible();
    });
  }

  private validateWindowState(state: WindowState): WindowState {
    const displays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    
    // Default to primary display if no displays found
    if (displays.length === 0) {
      return {
        x: 0,
        y: 0,
        width: 1024,
        height: 768,
        isMaximized: false,
        isFullScreen: false
      };
    }

    // Check if the window position is within any display
    const isWithinDisplay = displays.some(display => {
      const { x, y, width, height } = display.workArea;
      return state.x >= x && state.y >= y && 
             state.x + state.width <= x + width && 
             state.y + state.height <= y + height;
    });

    if (!isWithinDisplay) {
      // Center on primary display
      const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
      return {
        ...state,
        x: Math.round((screenWidth - state.width) / 2),
        y: Math.round((screenHeight - state.height) / 2)
      };
    }

    // Ensure minimum window size
    const minWidth = 800;
    const minHeight = 600;

    return {
      ...state,
      width: Math.max(state.width, minWidth),
      height: Math.max(state.height, minHeight)
    };
  }

  public getDefaultWindowState(): WindowState {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
    
    const defaultWidth = Math.min(1200, screenWidth * 0.8);
    const defaultHeight = Math.min(800, screenHeight * 0.8);
    
    return {
      x: Math.round((screenWidth - defaultWidth) / 2),
      y: Math.round((screenHeight - defaultHeight) / 2),
      width: defaultWidth,
      height: defaultHeight,
      isMaximized: false,
      isFullScreen: false
    };
  }

  public cleanup(): void {
    this.mainWindow = null;
    this.windowState = null;
  }
}