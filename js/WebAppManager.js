class WebAppManager {
  constructor(options = {}) {
    this.supabase = null;
    this.containerId = null;
    this.originalContent = null;
    this.requireHomeScreen = options.requireHomeScreen || false;
    this.splashDuration = options.splashDuration || 2000;
    this.appID = options.appID || null;
    this.deviceID = this.getDeviceID();
    this.appDetails = null;
  }

  getDeviceID() {
    // Get or create device ID from localStorage
    let deviceID = localStorage.getItem('deviceID');
    if (!deviceID) {
      deviceID = this.generateCode();
      localStorage.setItem('deviceID', deviceID);
    }
    return deviceID;
  }

  generateCode() {
    // Generate a random device ID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async initialize(containerId) {
    this.containerId = containerId;
    
    if (!this.appID) {
      console.error('appID is required. Please pass it in the constructor options.');
      return;
    }

    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container with id "${this.containerId}" not found`);
      return;
    }

    // Save the original content
    this.originalContent = container.innerHTML;

    // Show splash screen first (without icon)
    this.showSplashScreen();

    try {
      // Get app details first
      await this.getAppDetails();
      
      // Update splash screen with app icon
      this.showSplashScreen();
      
    } catch (error) {
      console.error('Error getting app details:', error);
    }

    // Import Supabase client
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    
    // Initialize Supabase client
    this.supabase = createClient(
      'https://jsxfeosppbjbjkfixdeh.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzeGZlb3NwcGJqYmprZml4ZGVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTE1MzYxMjgsImV4cCI6MjAwNzExMjEyOH0.iybCB4mlzcRVL0rRUnRNmH8WV2YXxOil-SUaHBe87As'
    );

    // Wait for splash screen duration
    await new Promise(resolve => setTimeout(resolve, this.splashDuration));

    // Check if user data exists in localStorage
    const storedEmail = localStorage.getItem('email');
    const storedUserID = localStorage.getItem('userID');

    if (storedEmail && storedUserID) {
      console.log('User data found in localStorage');
      
      try {
        // Check if email is valid for this app
        const emailValid = await this.checkEmail(storedEmail);
        
        if (emailValid) {
          // Verify user with the API
          const verified = await this.verifyUser(storedUserID);
          
          if (verified) {
            console.log('User verified successfully');
            this.restoreOriginalContent();
            return;
          }
        }
        
        // If verification fails, clear storage and show login
        localStorage.removeItem('email');
        localStorage.removeItem('userID');
        localStorage.removeItem('fullName');
      } catch (error) {
        console.error('Verification error:', error);
        localStorage.removeItem('email');
        localStorage.removeItem('userID');
        localStorage.removeItem('fullName');
      }
    }

    // Check if we should show home screen prompt
    if (this.requireHomeScreen && !this.isRunningAsApp()) {
      this.showHomeScreenPrompt();
      return;
    }

    // Show login form if not logged in
    this.showLoginForm();
  }

  async checkEmail(email) {
    try {
      const response = await fetch('https://api.magicapps.co.uk/api/checkEmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          appID: this.appID
        })
      });

      const result = await response.text();
      return result === 'true';
    } catch (error) {
      console.error('Error checking email:', error);
      return false;
    }
  }

  async getUser(email) {
    try {
      const response = await fetch('https://api.magicapps.co.uk/api/getUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.toLowerCase()
        })
      });

      const data = await response.json();
      
      if (data.data && data.data.data && data.data.data.length > 0) {
        const user = data.data.data[0];
        localStorage.setItem('userID', user.uuid);
        localStorage.setItem('fullName', `${user.firstname} ${user.lastname}`);
        return user.uuid;
      }
      
      throw new Error('No user found');
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  async verifyUser(userID) {
    try {
      const response = await fetch('https://api.magicapps.co.uk/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          appID: this.appID,
          user: userID,
          deviceID: this.deviceID,
          deviceName: this.getDeviceName()
        })
      });

      const data = await response.json();
      
      if (data.type === 'success') {
        return true;
      } else {
        if (data.errors && data.errors.length > 0) {
          throw new Error(data.errors[0].message);
        }
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Error verifying user:', error);
      throw error;
    }
  }

  getDeviceName() {
    const userAgent = navigator.userAgent;
    
    // Check for iOS devices
    if (/iPad/.test(userAgent)) return 'iPad';
    if (/iPhone/.test(userAgent)) return 'iPhone';
    if (/iPod/.test(userAgent)) return 'iPod';
    
    // Check for Android
    if (/Android/.test(userAgent)) {
      const match = userAgent.match(/Android.*;\s([^)]+)/);
      return match ? match[1] : 'Android Device';
    }
    
    // Check for common browsers/platforms
    if (/Mac/.test(userAgent)) return 'Mac';
    if (/Win/.test(userAgent)) return 'Windows PC';
    if (/Linux/.test(userAgent)) return 'Linux PC';
    
    return 'Web Browser';
  }

  isRunningAsApp() {
    // Check if running as standalone PWA
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
  }

  async getAppDetails() {
    try {
      const response = await fetch(`https://api.magicapps.co.uk/api/app/${this.appID}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data && data.length > 0) {
        this.appDetails = data[0];
        this.appSlug = this.appDetails.slug;
        console.log('App details loaded:', this.appDetails);
        return this.appDetails;
      }
      
      throw new Error('No app details found');
    } catch (error) {
      console.error('Error getting app details:', error);
      throw error;
    }
  }

  showSplashScreen() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const appIcon = this.appDetails?.appicon || '';
    const appName = this.appDetails?.name || 'WebApp';

    const iconHTML = appIcon 
      ? `<img src="${appIcon}" class="wam-splash-icon" />`
      : ``;

    container.innerHTML = `
      <style>
        .wam-splash-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: #0f0f0f;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0 20px;
          box-sizing: border-box;
        }

        .wam-splash-content {
          text-align: center;
          color: #ffffff;
        }

        .wam-splash-icon {
          width: 120px;
          height: 120px;
          border-radius: 24px;
          margin-bottom: 30px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }

        .wam-splash-logo {
          font-size: 48px;
          font-weight: 700;
          margin-bottom: 30px;
          background: linear-gradient(135deg, #4a9eff 0%, #3a8eef 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .wam-splash-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #3a3a3a;
          border-top-color: #4a9eff;
          border-radius: 50%;
          animation: wam-spin 1s linear infinite;
          margin: 0 auto;
        }

        @keyframes wam-spin {
          to { transform: rotate(360deg); }
        }
      </style>

      <div class="wam-splash-wrapper">
        <div class="wam-splash-content">
          ${iconHTML}
          <div class="wam-splash-spinner"></div>
        </div>
      </div>
    `;
  }

  showHomeScreenPrompt() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Detect device and browser
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isAndroid = /Android/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/CriOS/.test(userAgent);
    const isChrome = /Chrome/.test(userAgent) || /CriOS/.test(userAgent);
    const isFirefox = /Firefox/.test(userAgent) || /FxiOS/.test(userAgent);
    const isSamsung = /SamsungBrowser/.test(userAgent);
    const isEdge = /Edg/.test(userAgent);

    let browserName = 'your browser';
    let browserIcon = 'fa-globe';
    let instructions = '';
    let warningMessage = '';

    if (isIOS) {
      if (isSafari) {
        browserName = 'Safari';
        browserIcon = 'fa-safari';
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-arrow-up-from-bracket wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Tap the Share button</div>
              <div class="wam-step-desc">Tap the <i class="fas fa-arrow-up-from-bracket"></i> icon at the bottom center or top right of Safari</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-plus-square wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Find "Add to Home Screen"</div>
              <div class="wam-step-desc">Scroll down in the share menu and tap "Add to Home Screen"</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-check-circle wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Confirm Installation</div>
              <div class="wam-step-desc">Tap "Add" in the top right to install the app</div>
            </div>
          </div>
        `;
      } else if (isChrome) {
        browserName = 'Chrome';
        browserIcon = 'fa-chrome';
        warningMessage = `
          <div class="wam-warning">
            <i class="fas fa-exclamation-triangle"></i>
            Chrome on iOS doesn't support installing apps. Please open this page in Safari instead.
          </div>
        `;
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-share-nodes wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Open in Safari</div>
              <div class="wam-step-desc">Tap the <i class="fas fa-ellipsis-vertical"></i> menu and select "Open in Safari"</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-arrow-up-from-bracket wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Use Safari's Share button</div>
              <div class="wam-step-desc">Once in Safari, tap the <i class="fas fa-arrow-up-from-bracket"></i> share icon</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-plus-square wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Add to Home Screen</div>
              <div class="wam-step-desc">Select "Add to Home Screen" and tap "Add"</div>
            </div>
          </div>
        `;
      } else if (isFirefox) {
        browserName = 'Firefox';
        browserIcon = 'fa-firefox-browser';
        warningMessage = `
          <div class="wam-warning">
            <i class="fas fa-exclamation-triangle"></i>
            Firefox on iOS doesn't support installing apps. Please open this page in Safari instead.
          </div>
        `;
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-share-nodes wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Open in Safari</div>
              <div class="wam-step-desc">Tap the menu and look for "Open in Safari" or copy the URL to Safari</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-arrow-up-from-bracket wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Use Safari's Share button</div>
              <div class="wam-step-desc">Once in Safari, tap the <i class="fas fa-arrow-up-from-bracket"></i> share icon</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-plus-square wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Add to Home Screen</div>
              <div class="wam-step-desc">Select "Add to Home Screen" and tap "Add"</div>
            </div>
          </div>
        `;
      } else {
        browserName = 'your browser';
        warningMessage = `
          <div class="wam-warning">
            <i class="fas fa-exclamation-triangle"></i>
            For best compatibility, please open this page in Safari.
          </div>
        `;
        instructions = `
          <div class="wam-prompt-step">
            <i class="fab fa-safari wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">Open in Safari</div>
              <div class="wam-step-desc">Copy this URL and open it in Safari to install the app</div>
            </div>
          </div>
        `;
      }
    } else if (isAndroid) {
      if (isChrome) {
        browserName = 'Chrome';
        browserIcon = 'fa-chrome';
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-ellipsis-vertical wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Tap the Menu button</div>
              <div class="wam-step-desc">Tap the <i class="fas fa-ellipsis-vertical"></i> icon in the top right corner</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-download wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Select "Install app" or "Add to Home screen"</div>
              <div class="wam-step-desc">Look for the install option in the menu</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-check-circle wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Confirm Installation</div>
              <div class="wam-step-desc">Tap "Install" or "Add" to complete</div>
            </div>
          </div>
        `;
      } else if (isFirefox) {
        browserName = 'Firefox';
        browserIcon = 'fa-firefox-browser';
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-ellipsis-vertical wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Tap the Menu button</div>
              <div class="wam-step-desc">Tap the <i class="fas fa-ellipsis-vertical"></i> icon in the toolbar</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-download wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Select "Install"</div>
              <div class="wam-step-desc">Look for "Install" or "Add to Home screen" option</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-check-circle wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Confirm Installation</div>
              <div class="wam-step-desc">Tap "Add" or "Install" to complete</div>
            </div>
          </div>
        `;
      } else if (isSamsung) {
        browserName = 'Samsung Internet';
        browserIcon = 'fa-globe';
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-bars wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Tap the Menu button</div>
              <div class="wam-step-desc">Tap the menu icon at the bottom of the screen</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-download wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Select "Add page to"</div>
              <div class="wam-step-desc">Then choose "Home screen"</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-check-circle wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Confirm Installation</div>
              <div class="wam-step-desc">Tap "Add" to install the app</div>
            </div>
          </div>
        `;
      } else if (isEdge) {
        browserName = 'Edge';
        browserIcon = 'fa-edge';
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-ellipsis-h wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Tap the Menu button</div>
              <div class="wam-step-desc">Tap the <i class="fas fa-ellipsis-h"></i> icon at the bottom</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-download wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Select "Add to phone"</div>
              <div class="wam-step-desc">Look for the install or add to home screen option</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-check-circle wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Confirm Installation</div>
              <div class="wam-step-desc">Tap "Add" to complete</div>
            </div>
          </div>
        `;
      } else {
        browserName = 'your browser';
        instructions = `
          <div class="wam-prompt-step">
            <i class="fas fa-ellipsis-vertical wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">1. Open the browser menu</div>
              <div class="wam-step-desc">Look for the menu button (usually <i class="fas fa-ellipsis-vertical"></i> or <i class="fas fa-bars"></i>)</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-download wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">2. Find install option</div>
              <div class="wam-step-desc">Look for "Install", "Add to Home screen", or similar</div>
            </div>
          </div>
          <div class="wam-prompt-step">
            <i class="fas fa-check-circle wam-step-icon"></i>
            <div class="wam-step-content">
              <div class="wam-step-title">3. Confirm Installation</div>
              <div class="wam-step-desc">Follow the prompts to complete installation</div>
            </div>
          </div>
        `;
      }
    } else {
      browserName = 'Desktop';
      instructions = `
        <div class="wam-prompt-step">
          <i class="fas fa-mobile-screen wam-step-icon"></i>
          <div class="wam-step-content">
            <div class="wam-step-title">Please access from mobile device</div>
            <div class="wam-step-desc">This app requires installation on a mobile device (iOS or Android)</div>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <style>
        .wam-prompt-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: #0f0f0f;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0 20px;
          box-sizing: border-box;
        }

        .wam-prompt-container {
          background-color: #1a1a1a;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 450px;
          width: 90%;
          padding: 40px;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          text-align: center;
        }

        .wam-prompt-icon {
          font-size: 72px;
          margin-bottom: 20px;
          color: #4a9eff;
        }

        .wam-prompt-title {
          font-size: 26px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .wam-prompt-text {
          font-size: 15px;
          line-height: 1.6;
          color: #b0b0b0;
          margin-bottom: 30px;
        }

        .wam-prompt-steps {
          text-align: left;
          margin-bottom: 20px;
        }

        .wam-prompt-step {
          display: flex;
          align-items: flex-start;
          margin-bottom: 24px;
          padding: 16px;
          background-color: #2a2a2a;
          border-radius: 8px;
          border-left: 3px solid #4a9eff;
        }

        .wam-prompt-step:last-child {
          margin-bottom: 0;
        }

        .wam-step-icon {
          font-size: 24px;
          color: #4a9eff;
          margin-right: 16px;
          margin-top: 2px;
          min-width: 24px;
        }

        .wam-step-content {
          flex: 1;
        }

        .wam-step-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #ffffff;
        }

        .wam-step-desc {
          font-size: 14px;
          color: #9a9a9a;
          line-height: 1.4;
        }

        .wam-step-desc i {
          color: #4a9eff;
        }

        .wam-prompt-footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #3a3a3a;
          font-size: 13px;
          color: #7a7a7a;
        }

        .wam-prompt-footer i {
          color: #4a9eff;
          margin-right: 6px;
        }

        .wam-browser-badge {
          display: inline-flex;
          align-items: center;
          background-color: #2a2a2a;
          padding: 8px 16px;
          border-radius: 20px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #b0b0b0;
        }

        .wam-browser-badge i {
          margin-right: 8px;
          color: #4a9eff;
          font-size: 16px;
        }

        .wam-warning {
          background-color: #3a2a1a;
          border-left: 3px solid #ff9800;
          padding: 16px;
          border-radius: 6px;
          margin-bottom: 20px;
          font-size: 14px;
          color: #ffb74d;
          text-align: left;
        }

        .wam-warning i {
          margin-right: 8px;
        }
      </style>

      <div class="wam-prompt-wrapper">
        <div class="wam-prompt-container">
          <div class="wam-prompt-icon">
            <i class="fas fa-mobile-screen-button"></i>
          </div>
          <h2 class="wam-prompt-title">Installation Required</h2>
          <div class="wam-browser-badge">
            <i class="fab ${browserIcon}"></i>
            Detected: ${browserName}
          </div>
          <p class="wam-prompt-text">
            To access this app, please install it on your device's home screen.
          </p>
          ${warningMessage}
          <div class="wam-prompt-steps">
            ${instructions}
          </div>
          <div class="wam-prompt-footer">
            <i class="fas fa-info-circle"></i>
            The app will automatically open after installation
          </div>
        </div>
      </div>
    `;
  }

  showLoginForm() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error(`Container with id "${this.containerId}" not found`);
      return;
    }

    container.innerHTML = `
      <style>
        .wam-login-wrapper {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: #0f0f0f;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 0 20px;
          box-sizing: border-box;
        }

        .wam-login-container {
          background-color: #1a1a1a;
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px;
          width: 90%;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }

        .wam-login-title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 30px;
          text-align: center;
        }

        .wam-form-group {
          margin-bottom: 20px;
        }

        .wam-label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          color: #b0b0b0;
        }

        .wam-input {
          width: 100%;
          padding: 12px;
          background-color: #2a2a2a;
          border: 1px solid #3a3a3a;
          border-radius: 6px;
          color: #ffffff;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .wam-input:focus {
          outline: none;
          border-color: #4a9eff;
        }

        .wam-button {
          width: 100%;
          padding: 12px;
          background-color: #4a9eff;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .wam-button:hover {
          background-color: #3a8eef;
        }

        .wam-button:disabled {
          background-color: #3a3a3a;
          cursor: not-allowed;
        }

        .wam-error {
          color: #ff6b6b;
          font-size: 14px;
          margin-top: 10px;
          text-align: center;
        }

        .wam-success {
          color: #51cf66;
          font-size: 14px;
          margin-top: 10px;
          text-align: center;
        }
      </style>

      <div class="wam-login-wrapper">
        <div class="wam-login-container">
          <h2 class="wam-login-title">Sign In</h2>
          <form id="wam-login-form">
          <div class="wam-form-group">
            <label class="wam-label" for="wam-email">Email</label>
            <input 
              type="email" 
              id="wam-email" 
              class="wam-input" 
              placeholder="you@example.com"
              required
            />
          </div>
          <div class="wam-form-group">
            <label class="wam-label" for="wam-password">Password</label>
            <input 
              type="password" 
              id="wam-password" 
              class="wam-input" 
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" class="wam-button">Sign In</button>
          <div id="wam-message"></div>
        </form>
        </div>
      </div>
    `;

    // Attach event listener
    const form = document.getElementById('wam-login-form');
    form.addEventListener('submit', (e) => this.handleLogin(e));
  }

  async handleLogin(event) {
    event.preventDefault();
    
    let email = document.getElementById('wam-email').value.toLowerCase();
    const password = document.getElementById('wam-password').value;
    const messageDiv = document.getElementById('wam-message');
    const button = event.target.querySelector('button');

    button.disabled = true;
    messageDiv.innerHTML = '';

    try {
      // First check if the email is valid for this app
      const emailValid = await this.checkEmail(email);
      
      // Try to sign in with Supabase
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: emailValid ? email : this.getEmailWithSlug(email),
        password
      });

      if (error) {
        throw error;
      }

      console.log('Supabase login successful');
      
      // Sign out from Supabase (we only use it for authentication)
      await this.supabase.auth.signOut();
      
      // Get user details from API
      const userID = await this.getUser(emailValid ? email : this.getEmailWithSlug(email));
      
      // Verify user has access to this app
      await this.verifyUser(userID);
      
      // Store email for future use
      localStorage.setItem('email', email);
      
      messageDiv.innerHTML = '<div class="wam-success">Login successful!</div>';
      console.log('User logged in and verified');
      
      // Restore original content after successful login
      setTimeout(() => {
        this.restoreOriginalContent();
      }, 1000);
      
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = this.parseAuthError(error);
      messageDiv.innerHTML = `<div class="wam-error">${errorMessage}</div>`;
    } finally {
      button.disabled = false;
    }
  }

  getEmailWithSlug(email) {
    const slug = this.appSlug || '';
    if (slug && email.includes('@')) {
      return email.replace('@', `+${slug}@`);
    }
    return email;
  }

  parseAuthError(error) {
    const errorString = error.message?.toLowerCase() || error.toString().toLowerCase();
    
    if (errorString.includes('invalid login credentials') || errorString.includes('invalid_grant')) {
      return 'The email or password you entered is incorrect. Please try again.';
    } else if (errorString.includes('email not confirmed')) {
      return 'Please verify your email address before logging in.';
    } else if (errorString.includes('network') || errorString.includes('connection')) {
      return 'Unable to connect. Please check your internet connection and try again.';
    } else if (errorString.includes('timeout')) {
      return 'The request took too long. Please try again.';
    } else if (errorString.includes('user not found')) {
      return 'No account found with this email address.';
    } else if (errorString.includes('no user found')) {
      return 'Cannot get user details. Please contact support.';
    } else if (errorString.includes('verification failed')) {
      return 'You do not have access to this app. Please check your license.';
    } else {
      return 'An error occurred during login. Please try again later.';
    }
  }

  restoreOriginalContent() {
    const container = document.getElementById(this.containerId);
    if (container && this.originalContent) {
      container.innerHTML = this.originalContent;
    }
  }
}

// Export for use in browser
if (typeof window !== 'undefined') {
  window.WebAppManager = WebAppManager;
  // Store instance globally for button callbacks
  window.webAppManager = null;
}
