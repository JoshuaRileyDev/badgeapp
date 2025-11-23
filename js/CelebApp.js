class CelebApp {
    constructor() {
        this.dbName = 'CelebSelfieDB';  // Changed to avoid conflict with old BadgeAppDB
        this.dbVersion = 1;
        this.db = null;
        this.userImage = null;
        this.inputTimeout = null;
        this.debugMode = false;  // Debug mode toggle
        
        // MagicApps API configuration
        this.baseAPI = 'https://api.magicapps.co.uk/api';
        this.appID = 'c6b356d1-d6b4-4ebb-bae2-4b3ba53d71d3';
        this.userID = null;
        this.credits = 0;
        
        // Celebrity list for Fuse.js matching
        this.celebrities = [
            'Tom Cruise', 'Tom Hiddleston', 'Tom Hardy', 'Brad Pitt', 'Leonardo DiCaprio', 'Will Smith', 'Johnny Depp',
            'Robert Downey Jr', 'Chris Hemsworth', 'Chris Evans', 'Ryan Reynolds', 'Dwayne Johnson',
            'Scarlett Johansson', 'Jennifer Lawrence', 'Emma Watson', 'Angelina Jolie', 'Margot Robbie',
            'Gal Gadot', 'Emma Stone', 'Anne Hathaway', 'Natalie Portman', 'Charlize Theron',
            'Tom Holland', 'Zendaya', 'Timothée Chalamet', 'Florence Pugh', 'Anya Taylor-Joy',
            'Pedro Pascal', 'Oscar Isaac', 'Michael B Jordan', 'Chadwick Boseman', 'Keanu Reeves',
            'Taylor Swift', 'Ariana Grande', 'Billie Eilish', 'Harry Styles', 'Drake',
            'Beyoncé', 'Rihanna', 'Lady Gaga', 'Justin Bieber', 'The Weeknd',
            'Elon Musk', 'Mark Zuckerberg', 'Bill Gates', 'Jeff Bezos', 'Steve Jobs',
            'Barack Obama', 'Donald Trump', 'Joe Biden', 'Kamala Harris', 'Bernie Sanders'
        ];
        
        this.init();
    }

    async init() {
        // Clean up old databases if they exist
        await this.cleanupOldDatabases();
        
        // Initialize WebAppManager first
        await this.initWebAppManager();
        
        await this.initDB();
        await this.loadSavedState();
        await this.loadUserID();
        if (this.userID) {
            await this.loadCredits();
        }
        this.setupEventListeners();
        this.createSettingsModal();
        this.createDebugOverlay();
        this.createImageStatusIndicator();
        await this.loadDebugMode();
    }

    // Clean up old databases from previous app versions
    async cleanupOldDatabases() {
        try {
            const oldDatabases = ['BadgeAppDB', 'CelebAppDB'];
            for (const dbName of oldDatabases) {
                await new Promise((resolve) => {
                    const deleteRequest = indexedDB.deleteDatabase(dbName);
                    deleteRequest.onsuccess = () => {
                        console.log(`Deleted old database: ${dbName}`);
                        resolve();
                    };
                    deleteRequest.onerror = () => {
                        console.log(`Could not delete database: ${dbName}`);
                        resolve();
                    };
                    deleteRequest.onblocked = () => {
                        console.log(`Delete blocked for database: ${dbName}`);
                        resolve();
                    };
                });
            }
        } catch (error) {
            console.error('Error cleaning up old databases:', error);
        }
    }

    // Initialize WebAppManager for authentication
    async initWebAppManager() {
        try {
            window.webAppManager = new WebAppManager({
                appID: this.appID,
                requireHomeScreen: true,  // Require app to be installed to home screen
                splashDuration: 2000
            });
            
            await window.webAppManager.initialize('wam-container');
            console.log('WebAppManager initialized');
            
            // Show app content after successful verification
            this.showAppContent();
        } catch (error) {
            console.error('Failed to initialize WebAppManager:', error);
        }
    }

    // Show app content after verification
    showAppContent() {
        const appContent = document.getElementById('appContent');
        if (appContent) {
            appContent.classList.add('verified');
            console.log('App content now visible');
        }
    }

    // Load User ID from localStorage (set by WebAppManager after login)
    async loadUserID() {
        try {
            // Get userID from localStorage (set by WebAppManager after successful login)
            const userID = localStorage.getItem('userID');
            
            if (userID) {
                this.userID = userID;
                console.log('User ID loaded from localStorage:', this.userID);
            } else {
                console.warn('No user ID found. User may need to log in.');
            }
        } catch (error) {
            console.error('Error loading user ID:', error);
        }
    }

    // Load credits from MagicApps API
    async loadCredits() {
        if (!this.userID) return;

        try {
            const response = await fetch(`${this.baseAPI}/ai-credits/balance`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userID: this.userID,
                    appID: this.appID
                })
            });

            const data = await response.json();
            
            if (data.type === 'success') {
                this.credits = data.credits;
                this.updateCreditsDisplay();
                this.debugLog(`💰 Credits loaded: ${data.credits}`, 'success');
            } else {
                console.error('Failed to load credits:', data.message);
                this.debugLog(`❌ Failed to load credits: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Error loading credits:', error);
            this.debugLog(`❌ Error loading credits: ${error.message}`, 'error');
        }
    }

    // Update credits display in settings modal
    updateCreditsDisplay() {
        const creditsDisplay = document.getElementById('creditsDisplay');
        if (creditsDisplay) {
            creditsDisplay.textContent = this.credits;
        }
    }

    // IndexedDB Setup
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings');
                }
                
                if (!db.objectStoreNames.contains('homeScreenImage')) {
                    db.createObjectStore('homeScreenImage');
                }
            };
        });
    }

    // Load saved state from IndexedDB
    async loadSavedState() {
        try {
            const savedUserImage = await this.getFromDB('settings', 'userImage');
            if (savedUserImage) {
                // Convert base64 to File object
                this.userImage = await this.base64ToFile(savedUserImage, 'user-image.jpg');
            }

            const imageData = await this.getFromDB('homeScreenImage', 'image');
            if (imageData) {
                const img = document.querySelector('.fullscreen-image');
                if (img) {
                    img.src = imageData;
                }
            }
        } catch (error) {
            console.error('Error loading saved state:', error);
        }
    }

    // Convert base64 string to File object
    async base64ToFile(base64String, filename) {
        try {
            const response = await fetch(base64String);
            const blob = await response.blob();
            return new File([blob], filename, { type: blob.type });
        } catch (error) {
            console.error('Error converting base64 to file:', error);
            return null;
        }
    }

    // IndexedDB helper functions
    saveToDB(storeName, key, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data, key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    getFromDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Setup event listeners
    setupEventListeners() {
        const settingsBtn = document.getElementById('settingsBtn');
        settingsBtn.addEventListener('click', () => {
            this.openSettingsModal();
        });

        const homescreen = document.getElementById('homescreen');
        homescreen.addEventListener('click', (e) => {
            this.handleHomescreenTap(e);
        });

        // Setup text input event listener
        const textInput = document.getElementById('hiddenTextInput');
        textInput.addEventListener('input', (e) => {
            this.handleTextInput(e);
        });
        
        textInput.addEventListener('blur', () => {
            this.hideBlackOverlay();
        });
    }

    // Handle homescreen tap
    handleHomescreenTap(e) {
        // Create ripple effect
        this.createRipple(e.clientX, e.clientY);

        // Show black overlay and focus text input
        this.showBlackOverlay();
        this.focusTextInput();
    }

    // Create ripple animation
    createRipple(x, y) {
        const ripple = document.createElement('div');
        ripple.className = 'tap-ripple';
        ripple.style.left = (x - 50) + 'px';
        ripple.style.top = (y - 50) + 'px';
        document.body.appendChild(ripple);

        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    // Show black overlay
    showBlackOverlay() {
        const overlay = document.getElementById('blackOverlay');
        overlay.classList.add('active');
    }

    // Hide black overlay
    hideBlackOverlay() {
        const overlay = document.getElementById('blackOverlay');
        overlay.classList.remove('active');
    }

    // Focus text input and show keyboard
    focusTextInput() {
        // Check if user image is set
        if (!this.userImage || !(this.userImage instanceof File)) {
            this.showImageRequiredMessage();
            return;
        }
        
        const textInput = document.getElementById('hiddenTextInput');
        textInput.value = ''; // Clear previous input
        textInput.focus();
        
        // Show visual indicator that keyboard is active
        this.showKeyboardIndicator();
    }

    // Handle text input
    handleTextInput(e) {
        const input = e.target.value.trim();
        
        if (input.length > 0) {
            this.debugLog(`📝 Text input: "${input}"`, 'input');
            
            // Clear previous timeout
            clearTimeout(this.inputTimeout);
            
            // Process the input when user stops typing (debounce)
            this.inputTimeout = setTimeout(() => {
                this.processCelebrityName(input);
            }, 800); // Slightly longer debounce for better UX
        }
    }

    // Show keyboard indicator
    showKeyboardIndicator() {
        this.showLoadingMessage('Type a celebrity name...');
    }

    // Show image required message
    showImageRequiredMessage() {
        this.showBlackOverlay();
        
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.95);
            color: #333;
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            z-index: 1001;
            max-width: 350px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        `;
        
        messageDiv.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 15px;">📷</div>
            <h3 style="margin: 0 0 15px 0; color: #007AFF;">Image Required</h3>
            <p style="margin: 0 0 20px 0; line-height: 1.5;">Please upload your photo in settings before generating celebrity selfies.</p>
            <button onclick="window.celebApp.hideImageRequiredMessage()" style="
                background: #007AFF;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
            ">Go to Settings</button>
        `;
        
        const overlay = document.getElementById('blackOverlay');
        overlay.appendChild(messageDiv);
    }

    // Hide image required message
    hideImageRequiredMessage() {
        this.hideBlackOverlay();
        this.openSettingsModal();
    }

    // Show user image as full-width display
    showUserImageDisplay() {
        if (!this.userImage || !(this.userImage instanceof File)) {
            return;
        }

        this.showBlackOverlay();
        
        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1001;
            background: black;
        `;
        
        const img = document.createElement('img');
        img.style.cssText = `
            width: 100vw;
            height: 100vh;
            object-fit: contain;
            display: block;
        `;
        
        // Create object URL for the user image
        const imageUrl = URL.createObjectURL(this.userImage);
        img.src = imageUrl;
        
        // Add close on click
        imageContainer.addEventListener('click', () => {
            URL.revokeObjectURL(imageUrl);
            this.hideBlackOverlay();
        });
        
        imageContainer.appendChild(img);
        
        const overlay = document.getElementById('blackOverlay');
        overlay.appendChild(imageContainer);
    }

    // Process celebrity name using Fuse.js
    processCelebrityName(input) {
        this.debugLog(`Processing input: "${input}"`, 'info');
        
        // Clean up the input
        const cleanInput = input.trim();
        const inputWords = cleanInput.toLowerCase().split(/\s+/);
        
        // Require minimum input length to prevent premature matching
        if (cleanInput.length < 3) {
            this.debugLog(`Input too short (${cleanInput.length} chars), need at least 3`, 'info');
            return; // Don't process yet, let user keep typing
        }
        
        // Try to find celebrity name within the sentence
        let bestMatch = null;
        let bestScore = 1; // Lower is better in Fuse.js
        
        this.debugLog(`🔍 Searching for celebrity name in input...`, 'info');
        
        // Check each celebrity against the input sentence for exact match
        for (const celebrity of this.celebrities) {
            if (cleanInput.toLowerCase().includes(celebrity.toLowerCase())) {
                this.debugLog(`✓ Found exact match: "${celebrity}"`, 'success');
                bestMatch = celebrity;
                bestScore = 0;
                break;
            }
        }
        
        // If no exact match found, try fuzzy matching with smart criteria
        if (!bestMatch) {
            this.debugLog(`No exact match found, trying fuzzy search...`, 'info');
        
            // Configure Fuse.js for smart name matching
            const fuse = new Fuse(this.celebrities, {
                includeScore: true,
                threshold: 0.4,  // Moderate threshold for flexibility
                keys: [
                    {
                        name: 'name',
                        getFn: (item) => item
                    }
                ],
                ignoreLocation: true,
                findAllMatches: true,
                minMatchCharLength: 3,  // Minimum 3 characters to match
                distance: 100
            });

            const results = fuse.search(cleanInput);
            
            // Show top 5 matches in debug
            if (this.debugMode && results.length > 0) {
                this.debugLog(`Found ${results.length} potential matches:`, 'info');
                results.slice(0, 5).forEach((result, index) => {
                    this.debugLog(`  ${index + 1}. ${result.item} (score: ${result.score.toFixed(3)})`, 'info');
                });
            }
            
            // Smart matching logic based on input length and word count
            if (results.length > 0) {
                const topResult = results[0];
                const celebrityWords = topResult.item.toLowerCase().split(/\s+/);
                
                // Different criteria based on input characteristics
                let shouldAccept = false;
                
                if (inputWords.length >= 2) {
                    // Multi-word input: more lenient matching
                    shouldAccept = topResult.score < 0.3;
                    this.debugLog(`Multi-word input detected, using lenient threshold (< 0.3)`, 'info');
                } else if (cleanInput.length >= 6) {
                    // Single word but long enough: stricter matching
                    shouldAccept = topResult.score < 0.15;
                    this.debugLog(`Long single-word input, using strict threshold (< 0.15)`, 'info');
                } else if (cleanInput.length >= 4) {
                    // Short single word: very strict matching
                    shouldAccept = topResult.score < 0.1;
                    this.debugLog(`Short single-word input, using very strict threshold (< 0.1)`, 'info');
                }
                
                // Additional check: if input contains part of the celebrity name
                const inputLower = cleanInput.toLowerCase();
                const celebrityLower = topResult.item.toLowerCase();
                const hasPartialMatch = celebrityWords.some(word => 
                    word.includes(inputLower) || inputLower.includes(word)
                );
                
                if (hasPartialMatch && cleanInput.length >= 4) {
                    shouldAccept = true;
                    this.debugLog(`Partial name match detected, accepting`, 'info');
                }
                
                if (shouldAccept) {
                    bestMatch = topResult.item;
                    bestScore = topResult.score;
                    this.debugLog(`Fuzzy match: ${bestMatch} (score: ${bestScore.toFixed(3)})`, 'success');
                }
            }
        }
        
        if (bestMatch) {
            console.log('Matched celebrity:', bestMatch);
            this.debugLog(`✅ Final match: ${bestMatch} (score: ${bestScore.toFixed(3)})`, 'success');
            this.generateSelfie(bestMatch);
        } else {
            // Only show "no match" message if input is substantial enough
            if (cleanInput.length >= 4) {
                console.log('No celebrity match found for:', input);
                this.debugLog(`❌ No match found in: "${input}"`, 'error');
                this.debugLog('💡 Try typing full celebrity name (e.g., "Tom Cruise", "Tom Hiddleston")', 'info');
                this.hideBlackOverlay();
            }
        }
    }
        
        // Try to find celebrity name within the sentence
        let bestMatch = null;
        let bestScore = 1; // Lower is better in Fuse.js
        
        this.debugLog(`🔍 Searching for celebrity name in input...`, 'info');
        
        // Check each celebrity against the input sentence for exact match
        for (const celebrity of this.celebrities) {
            if (cleanInput.toLowerCase().includes(celebrity.toLowerCase())) {
                this.debugLog(`✓ Found exact match: "${celebrity}"`, 'success');
                bestMatch = celebrity;
                bestScore = 0;
                break;
            }
        }
        
        // If no exact match found, try fuzzy matching with stricter criteria
        if (!bestMatch) {
            this.debugLog(`No exact match found, trying fuzzy search...`, 'info');
        
            // Configure Fuse.js for more precise name matching
            const fuse = new Fuse(this.celebrities, {
                includeScore: true,
                threshold: 0.3,  // Stricter threshold for better accuracy
                keys: [
                    {
                        name: 'name',
                        getFn: (item) => item
                    }
                ],
                ignoreLocation: true,
                findAllMatches: true,
                minMatchCharLength: 4,  // Require at least 4 characters
                distance: 100  // Maximum distance between matches
            });

            const results = fuse.search(cleanInput);
            
            // Show top 5 matches in debug
            if (this.debugMode && results.length > 0) {
                this.debugLog(`Found ${results.length} potential matches:`, 'info');
                results.slice(0, 5).forEach((result, index) => {
                    this.debugLog(`  ${index + 1}. ${result.item} (score: ${result.score.toFixed(3)})`, 'info');
                });
            }
            
            // Only accept matches with very good scores and sufficient input length
            if (results.length > 0 && 
                results[0].score < 0.2 &&  // Much stricter score requirement
                cleanInput.length >= 4) {  // Require at least 4 characters input
                
                bestMatch = results[0].item;
                bestScore = results[0].score;
                this.debugLog(`Fuzzy match: ${bestMatch} (score: ${bestScore.toFixed(3)})`, 'success');
            }
        }
        
        if (bestMatch) {
            console.log('Matched celebrity:', bestMatch);
            this.debugLog(`✅ Final match: ${bestMatch} (score: ${bestScore.toFixed(3)})`, 'success');
            this.generateSelfie(bestMatch);
        } else {
            // Only show "no match" message if input is substantial enough
            if (cleanInput.length >= 4) {
                console.log('No celebrity match found for:', input);
                this.debugLog(`❌ No match found in: "${input}"`, 'error');
                this.debugLog('💡 Try typing the full celebrity name (e.g., "Tom Cruise", "Tom Hiddleston")', 'info');
                this.hideBlackOverlay();
            }
        }
    }

    // Generate selfie using MagicApps Replicate API
    async generateSelfie(celebrityName) {
        if (!this.userID) {
            alert('Please set your User ID in settings');
            this.hideBlackOverlay();
            return;
        }

        if (!this.userImage || !(this.userImage instanceof File)) {
            alert('Please upload your image in settings');
            this.hideBlackOverlay();
            return;
        }

        if (this.credits < 1) {
            alert('Insufficient credits. Please purchase more credits.');
            this.hideBlackOverlay();
            return;
        }

        try {
            console.log('Generating selfie with', celebrityName);
            
            // Show loading message on overlay
            this.showLoadingMessage('Generating selfie...');

            // Call MagicApps API which handles Replicate
            const formData = new FormData();
            formData.append('userID', this.userID);
            formData.append('appID', this.appID);
            formData.append('prompt', `a selfie photo with ${celebrityName}, professional photography, high quality, realistic`);
            
            // Add the user image to the images array (optional for Gemini)
            formData.append('images', this.userImage, this.userImage.name);

            const response = await fetch(`${this.baseAPI}/ai/replicate`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.type === 'success') {
                // Update credits
                this.credits = data.credits_remaining;
                this.updateCreditsDisplay();
                
                this.debugLog(`✅ Image generated! Credits used: ${data.credits_used}`, 'success');
                this.debugLog(`Credits remaining: ${data.credits_remaining}`, 'info');
                
                // Download and display the generated image
                await this.downloadAndDisplayImage(data.image, celebrityName);
            } else {
                throw new Error(data.message || 'Failed to generate image');
            }

        } catch (error) {
            console.error('Error generating selfie:', error);
            alert('Error generating image: ' + error.message);
            this.hideBlackOverlay();
        }
    }

    // Download image from URL and display it
    async downloadAndDisplayImage(imageUrl, celebrityName) {
        try {
            this.showLoadingMessage('Downloading image...');
            this.debugLog('📥 Downloading image from Replicate...', 'info');
            
            // Fetch the image
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error('Failed to download image');
            }
            
            const blob = await response.blob();
            const localUrl = URL.createObjectURL(blob);
            
            this.debugLog('✅ Image downloaded successfully', 'success');
            
            // Display the image
            this.displayGeneratedImage(localUrl, celebrityName, blob);
            
        } catch (error) {
            console.error('Error downloading image:', error);
            this.debugLog(`❌ Download failed: ${error.message}`, 'error');
            this.hideLoadingMessage();
            alert('Failed to download generated image');
            this.hideBlackOverlay();
        }
    }

    // Display generated image
    displayGeneratedImage(imageUrl, celebrityName, blob) {
        this.hideLoadingMessage();
        
        const img = document.createElement('img');
        img.className = 'generated-image';
        img.src = imageUrl;
        
        const overlay = document.getElementById('blackOverlay');
        overlay.appendChild(img);

        // Add download button
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = `💾 Save Selfie with ${celebrityName}`;
        downloadBtn.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            padding: 15px 30px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            z-index: 1002;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        downloadBtn.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = imageUrl;
            a.download = `selfie-with-${celebrityName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
            a.click();
        });
        
        overlay.appendChild(downloadBtn);

        // Trigger animation
        setTimeout(() => {
            img.classList.add('show');
        }, 10);

        // Close on click (but not on button)
        overlay.addEventListener('click', (e) => {
            if (e.target !== downloadBtn) {
                img.classList.remove('show');
                setTimeout(() => {
                    img.remove();
                    downloadBtn.remove();
                    this.hideBlackOverlay();
                    // Clean up object URL
                    if (blob) {
                        URL.revokeObjectURL(imageUrl);
                    }
                }, 400);
            }
        }, { once: true });
    }

    // Show loading message
    showLoadingMessage(message) {
        const existing = document.querySelector('.loading-message');
        if (existing) {
            existing.remove();
        }

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-message';
        loadingDiv.textContent = message;
        loadingDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 24px;
            font-weight: bold;
            z-index: 1001;
            text-align: center;
        `;

        const overlay = document.getElementById('blackOverlay');
        overlay.appendChild(loadingDiv);
    }

    // Hide loading message
    hideLoadingMessage() {
        const loadingDiv = document.querySelector('.loading-message');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    // Create settings modal
    createSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'settingsModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 5000;
            overflow-y: auto;
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 20px;
            padding: 30px;
            width: 90%;
            max-width: 400px;
            max-height: 90vh;
            overflow-y: auto;
        `;

        const title = document.createElement('h2');
        title.textContent = 'Settings';
        title.style.cssText = 'margin: 0 0 20px 0; font-size: 24px; font-weight: bold;';

        // Credits display
        const creditsContainer = document.createElement('div');
        creditsContainer.style.cssText = `
            background: #f0f0f0;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
            text-align: center;
        `;

        const creditsLabel = document.createElement('p');
        creditsLabel.textContent = 'Your Credits';
        creditsLabel.style.cssText = 'margin: 0 0 5px 0; color: #666; font-size: 14px;';

        const creditsDisplay = document.createElement('p');
        creditsDisplay.id = 'creditsDisplay';
        creditsDisplay.textContent = this.credits;
        creditsDisplay.style.cssText = 'margin: 0; font-size: 32px; font-weight: bold; color: #007AFF;';

        creditsContainer.appendChild(creditsLabel);
        creditsContainer.appendChild(creditsDisplay);

        // User info display (read-only)
        const userInfoLabel = document.createElement('label');
        userInfoLabel.textContent = 'User Info';
        userInfoLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';

        const userInfoDisplay = document.createElement('div');
        const userName = localStorage.getItem('fullName') || 'User';
        const userEmail = localStorage.getItem('email') || '';
        userInfoDisplay.innerHTML = `
            <div style="padding: 12px; background: #f0f0f0; border-radius: 8px; margin-bottom: 10px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${userName}</div>
                <div style="font-size: 14px; color: #666;">${userEmail}</div>
                <div style="font-size: 12px; color: #999; margin-top: 4px;">ID: ${this.userID || 'Not authenticated'}</div>
            </div>
        `;
        userInfoDisplay.style.cssText = 'margin-bottom: 20px;';

        // Logout button
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.style.cssText = `
            width: 100%;
            padding: 12px;
            background: #FF3B30;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 20px;
        `;

        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('email');
                localStorage.removeItem('userID');
                localStorage.removeItem('fullName');
                window.location.reload();
            }
        });

        // Image upload
        const imageLabel = document.createElement('label');
        imageLabel.textContent = 'Your Image *Required';
        imageLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500; color: #007AFF;';

        const imageContainer = document.createElement('div');
        imageContainer.style.cssText = 'margin-bottom: 15px;';

        const imageUpload = document.createElement('input');
        imageUpload.type = 'file';
        imageUpload.accept = 'image/*';
        imageUpload.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            margin-bottom: 10px;
            box-sizing: border-box;
        `;

        // Image status indicator
        const imageStatus = document.createElement('div');
        imageStatus.id = 'imageStatus';
        imageStatus.style.cssText = `
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        `;

        // View image button
        const viewImageBtn = document.createElement('button');
        viewImageBtn.textContent = '📷 View Your Image';
        viewImageBtn.style.cssText = `
            width: 100%;
            padding: 10px;
            background: #f0f0f0;
            color: #333;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            margin-bottom: 10px;
        `;

        imageContainer.appendChild(imageUpload);
        imageContainer.appendChild(imageStatus);
        imageContainer.appendChild(viewImageBtn);

        // Homescreen image upload
        const homescreenLabel = document.createElement('label');
        homescreenLabel.textContent = 'Homescreen Background';
        homescreenLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';

        const homescreenUpload = document.createElement('input');
        homescreenUpload.type = 'file';
        homescreenUpload.accept = 'image/*';
        homescreenUpload.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            box-sizing: border-box;
        `;

        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            width: 100%;
            padding: 15px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            margin-bottom: 10px;
        `;

        // Refresh credits button
        const refreshBtn = document.createElement('button');
        refreshBtn.textContent = 'Refresh Credits';
        refreshBtn.style.cssText = `
            width: 100%;
            padding: 12px;
            background: #34C759;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
        `;

        saveBtn.addEventListener('click', async () => {
            this.closeSettingsModal();
        });

        refreshBtn.addEventListener('click', async () => {
            await this.loadCredits();
        });

        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    alert('Please select an image file');
                    return;
                }
                
                // Validate file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    alert('Image file must be less than 10MB');
                    return;
                }
                
                // Store file object directly
                this.userImage = file;
                
                // Update status
                this.updateImageStatus(file);
                
                // Update indicator
                const indicator = document.getElementById('imageStatusIndicator');
                if (indicator) {
                    this.updateImageStatusIndicator(indicator);
                }
                
                // Save as base64 for persistence
                const reader = new FileReader();
                reader.onload = async (event) => {
                    await this.saveToDB('settings', 'userImage', event.target.result);
                };
                reader.readAsDataURL(file);
            }
        });

        viewImageBtn.addEventListener('click', () => {
            this.showUserImageDisplay();
        });

        homescreenUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const imageData = event.target.result;
                    const img = document.querySelector('.fullscreen-image');
                    img.src = imageData;
                    await this.saveToDB('homeScreenImage', 'image', imageData);
                };
                reader.readAsDataURL(file);
            }
        });

        // Debug mode toggle
        const debugLabel = document.createElement('label');
        debugLabel.textContent = 'Debug Mode';
        debugLabel.style.cssText = 'display: block; margin-bottom: 10px; margin-top: 10px; font-weight: 500;';

        const debugToggleContainer = document.createElement('div');
        debugToggleContainer.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px;
            background: #f0f0f0;
            border-radius: 8px;
            margin-bottom: 20px;
        `;

        const debugText = document.createElement('span');
        debugText.textContent = 'Show text input debug info';
        debugText.style.cssText = 'font-size: 14px;';

        const debugToggle = document.createElement('input');
        debugToggle.type = 'checkbox';
        debugToggle.id = 'debugToggle';
        debugToggle.checked = this.debugMode;
        debugToggle.style.cssText = `
            width: 40px;
            height: 20px;
            cursor: pointer;
        `;

        debugToggle.addEventListener('change', async (e) => {
            this.debugMode = e.target.checked;
            await this.saveToDB('settings', 'debugMode', this.debugMode);
            this.toggleDebugOverlay(this.debugMode);
        });

        debugToggleContainer.appendChild(debugText);
        debugToggleContainer.appendChild(debugToggle);

        content.appendChild(title);
        content.appendChild(creditsContainer);
        content.appendChild(userInfoLabel);
        content.appendChild(userInfoDisplay);
        content.appendChild(logoutBtn);
        content.appendChild(debugLabel);
        content.appendChild(debugToggleContainer);
        content.appendChild(imageLabel);
        content.appendChild(imageContainer);
        content.appendChild(homescreenLabel);
        content.appendChild(homescreenUpload);
        content.appendChild(saveBtn);
        content.appendChild(refreshBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeSettingsModal();
            }
        });
    }

    // Update image status display
    updateImageStatus(file) {
        const statusDiv = document.getElementById('imageStatus');
        if (statusDiv) {
            if (file) {
                const fileSize = (file.size / 1024 / 1024).toFixed(2);
                statusDiv.innerHTML = `✅ ${file.name} (${fileSize} MB)`;
                statusDiv.style.color = '#34C759';
            } else {
                statusDiv.innerHTML = '❌ No image uploaded';
                statusDiv.style.color = '#FF3B30';
            }
        }
    }

    // Open settings modal
    async openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'flex';
        
        // Refresh credits when opening settings
        if (this.userID) {
            await this.loadCredits();
        }
        
        // Update image status
        this.updateImageStatus(this.userImage);
    }

    // Close settings modal
    closeSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'none';
    }

    // Load debug mode from storage
    async loadDebugMode() {
        try {
            const savedDebugMode = await this.getFromDB('settings', 'debugMode');
            if (savedDebugMode !== undefined) {
                this.debugMode = savedDebugMode;
                this.toggleDebugOverlay(this.debugMode);
            }
        } catch (error) {
            console.error('Error loading debug mode:', error);
        }
    }

    // Create debug overlay
    createDebugOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'debugOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            width: 300px;
            max-height: 400px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            padding: 15px;
            border-radius: 10px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            z-index: 9999;
            display: none;
            overflow-y: auto;
            border: 2px solid #00ff00;
        `;

        const title = document.createElement('div');
        title.textContent = '⌨️ Text Input Debug';
        title.style.cssText = `
            font-weight: bold;
            margin-bottom: 10px;
            font-size: 14px;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 5px;
        `;

        const logContainer = document.createElement('div');
        logContainer.id = 'debugLog';
        logContainer.style.cssText = 'line-height: 1.4;';

        overlay.appendChild(title);
        overlay.appendChild(logContainer);
        document.body.appendChild(overlay);
    }

    // Create image status indicator
    createImageStatusIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'imageStatusIndicator';
        indicator.style.cssText = `
            position: fixed;
            top: env(safe-area-inset-top, 20px);
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 6px;
            transition: all 0.3s ease;
        `;

        this.updateImageStatusIndicator(indicator);
        document.body.appendChild(indicator);
    }

    // Update image status indicator
    updateImageStatusIndicator(indicator) {
        if (!this.userImage || !(this.userImage instanceof File)) {
            indicator.innerHTML = '📷 No Image';
            indicator.style.background = 'rgba(255, 59, 48, 0.9)';
        } else {
            indicator.innerHTML = '📷 Image Set';
            indicator.style.background = 'rgba(52, 199, 89, 0.9)';
        }
    }

    // Toggle debug overlay visibility
    toggleDebugOverlay(show) {
        const overlay = document.getElementById('debugOverlay');
        if (overlay) {
            overlay.style.display = show ? 'block' : 'none';
            if (show) {
                this.debugLog('Debug mode enabled', 'info');
            } else {
                // Clear log when hiding
                const logContainer = document.getElementById('debugLog');
                if (logContainer) {
                    logContainer.innerHTML = '';
                }
            }
        }
    }

    // Log debug message
    debugLog(message, type = 'info') {
        // Always log to console for debugging
        console.log(`[Debug ${type}]`, message);
        
        // Only show in overlay if debug mode is enabled
        if (!this.debugMode) return;

        const logContainer = document.getElementById('debugLog');
        if (!logContainer) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.style.cssText = 'margin-bottom: 8px; padding: 5px; border-left: 3px solid ';
        
        switch(type) {
            case 'error':
                logEntry.style.borderLeftColor = '#ff0000';
                logEntry.style.color = '#ff6666';
                break;
            case 'input':
                logEntry.style.borderLeftColor = '#00ffff';
                logEntry.style.color = '#00ffff';
                break;
            case 'success':
                logEntry.style.borderLeftColor = '#00ff00';
                logEntry.style.color = '#00ff00';
                break;
            default:
                logEntry.style.borderLeftColor = '#888888';
                logEntry.style.color = '#cccccc';
        }

        logEntry.innerHTML = `<span style="color: #666;">${timestamp}</span><br>${message}`;
        
        // Add to top of log
        logContainer.insertBefore(logEntry, logContainer.firstChild);

        // Keep only last 20 entries
        while (logContainer.children.length > 20) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.celebApp = new CelebApp();
});
