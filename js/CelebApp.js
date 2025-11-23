class CelebApp {
    constructor() {
        this.dbName = 'CelebSelfieDB';  // Changed to avoid conflict with old BadgeAppDB
        this.dbVersion = 1;
        this.db = null;
        this.userImage = null;
        this.inputTimeout = null;
        this.debugMode = false;  // Debug mode toggle
        this.customPrompt = 'a selfie photo with $$$, professional photography, high quality, realistic';  // Default custom prompt
        
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

            const savedCustomPrompt = await this.getFromDB('settings', 'customPrompt');
            if (savedCustomPrompt) {
                this.customPrompt = savedCustomPrompt;
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

            // Create prompt using custom template
            const prompt = this.customPrompt.replace('$$$', celebrityName);
            console.log('Using prompt:', prompt);
            
            // Call MagicApps API which handles Replicate
            const formData = new FormData();
            formData.append('userID', this.userID);
            formData.append('appID', this.appID);
            formData.append('prompt', prompt);
            
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
            backdrop-filter: blur(10px);
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 24px;
            padding: 0;
            width: 90%;
            max-width: 480px;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            position: relative;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
            color: white;
            padding: 24px;
            border-radius: 24px 24px 0 0;
            text-align: center;
            position: relative;
        `;

        const title = document.createElement('h2');
        title.textContent = '⚙️ Settings';
        title.style.cssText = 'margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.1);';

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Customize your celebrity selfie experience';
        subtitle.style.cssText = 'margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;';

        header.appendChild(title);
        header.appendChild(subtitle);

        // Main content area
        const mainContent = document.createElement('div');
        mainContent.style.cssText = 'padding: 24px;';

        // Credits section
        const creditsSection = this.createSection('💰 Credits', `
            <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 16px; padding: 20px; text-align: center; border: 2px solid #0ea5e9;">
                <div style="font-size: 14px; color: #0369a1; margin-bottom: 8px; font-weight: 600;">Available Credits</div>
                <div id="creditsDisplay" style="font-size: 36px; font-weight: 800; color: #0c4a6e; margin: 0;">${this.credits}</div>
            </div>
        `);

        // User info section
        const userName = localStorage.getItem('fullName') || 'User';
        const userEmail = localStorage.getItem('email') || '';
        const userInfoSection = this.createSection('👤 User Info', `
            <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                <div style="font-weight: 600; color: #1e293b; margin-bottom: 8px; font-size: 16px;">${userName}</div>
                <div style="color: #64748b; font-size: 14px; margin-bottom: 4px;">${userEmail}</div>
                <div style="color: #94a3b8; font-size: 12px;">ID: ${this.userID || 'Not authenticated'}</div>
            </div>
        `);

        // Custom prompt section
        const promptSection = this.createSection('✨ Custom Prompt', `
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px;">
                    AI Prompt Template
                    <span style="color: #6b7280; font-weight: 400; font-size: 12px; margin-left: 4px;">Use $$$ for celebrity name</span>
                </label>
                <textarea 
                    id="customPrompt" 
                    style="width: 100%; min-height: 80px; padding: 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; font-family: inherit; resize: vertical; background: #f9fafb; transition: all 0.2s;"
                    placeholder="Enter your custom prompt... use $$$ for celebrity name"
                >${this.customPrompt}</textarea>
                <div id="promptPreview" style="margin-top: 8px; padding: 12px; background: #f3f4f6; border-radius: 8px; font-size: 13px; color: #4b5563; border-left: 3px solid #9ca3af;">
                    <strong>Preview:</strong> <span id="previewText"></span>
                </div>
            </div>
        `);

        // Image upload section
        const imageSection = this.createSection('📷 Your Photo', `
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px;">
                    Profile Picture <span style="color: #ef4444;">*</span>
                </label>
                <div style="position: relative;">
                    <input 
                        type="file" 
                        id="imageUpload" 
                        accept="image/*"
                        style="width: 100%; padding: 12px 40px 12px 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; background: #f9fafb; cursor: pointer;"
                    />
                    <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af;">📁</div>
                </div>
                <div id="imageStatus" style="margin-top: 8px; font-size: 13px; color: #6b7280;"></div>
                <button 
                    id="viewImageBtn"
                    style="width: 100%; padding: 10px; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; cursor: pointer; margin-top: 8px; transition: all 0.2s;"
                >👁️ View Your Image</button>
            </div>
        `);

        // Homescreen section
        const homescreenSection = this.createSection('🖼️ Background', `
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-weight: 600; color: #374151; margin-bottom: 8px; font-size: 14px;">Home Screen Background</label>
                <div style="position: relative;">
                    <input 
                        type="file" 
                        id="homescreenUpload" 
                        accept="image/*"
                        style="width: 100%; padding: 12px 40px 12px 12px; border: 2px solid #e5e7eb; border-radius: 12px; font-size: 14px; background: #f9fafb; cursor: pointer;"
                    />
                    <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af;">📁</div>
                </div>
            </div>
        `);

        // Debug section
        const debugSection = this.createSection('🔧 Debug', `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <span style="font-size: 14px; color: #374151;">Show debug info</span>
                <label style="position: relative; display: inline-block; width: 48px; height: 24px;">
                    <input type="checkbox" id="debugToggle" ${this.debugMode ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
                    <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #d1d5db; transition: 0.3s; border-radius: 24px;"></span>
                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.3s; border-radius: 50%;"></span>
                </label>
            </div>
        `);

        // Action buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = 'display: flex; gap: 12px; margin-top: 24px;';

        const logoutBtn = this.createButton('🚪 Logout', '#ef4444', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('email');
                localStorage.removeItem('userID');
                localStorage.removeItem('fullName');
                window.location.reload();
            }
        });

        const refreshBtn = this.createButton('🔄 Refresh Credits', '#10b981', async () => {
            await this.loadCredits();
        });

        const saveBtn = this.createButton('💾 Save Settings', '#007AFF', () => {
            this.saveSettings();
        });

        actionsDiv.appendChild(logoutBtn);
        actionsDiv.appendChild(refreshBtn);
        actionsDiv.appendChild(saveBtn);

        mainContent.appendChild(creditsSection);
        mainContent.appendChild(userInfoSection);
        mainContent.appendChild(promptSection);
        mainContent.appendChild(imageSection);
        mainContent.appendChild(homescreenSection);
        mainContent.appendChild(debugSection);
        mainContent.appendChild(actionsDiv);

        content.appendChild(header);
        content.appendChild(mainContent);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Setup event listeners
        this.setupSettingsEventListeners();

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

    // Helper method to create sections
    createSection(title, content) {
        const section = document.createElement('div');
        section.style.cssText = 'margin-bottom: 20px;';
        
        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = title;
        sectionTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #1f2937;';
        
        const sectionContent = document.createElement('div');
        sectionContent.innerHTML = content;
        
        section.appendChild(sectionTitle);
        section.appendChild(sectionContent);
        
        return section;
    }

    // Helper method to create buttons
    createButton(text, color, onClick) {
        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            flex: 1;
            padding: 12px 16px;
            background: ${color};
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
        
        button.addEventListener('click', onClick);
        
        return button;
    }

    // Setup settings event listeners
    setupSettingsEventListeners() {
        // Custom prompt handling
        const customPrompt = document.getElementById('customPrompt');
        const previewText = document.getElementById('previewText');
        
        const updatePreview = () => {
            const prompt = customPrompt.value;
            this.customPrompt = prompt;
            const preview = prompt.replace('$$$', 'Tom Cruise');
            previewText.textContent = preview;
        };
        
        customPrompt.addEventListener('input', updatePreview);
        updatePreview(); // Initial preview

        // Image upload handling
        const imageUpload = document.getElementById('imageUpload');
        const imageStatus = document.getElementById('imageStatus');
        const viewImageBtn = document.getElementById('viewImageBtn');
        
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    this.showNotification('Please select an image file', 'error');
                    return;
                }
                
                // Validate file size (max 10MB)
                if (file.size > 10 * 1024 * 1024) {
                    this.showNotification('Image file must be less than 10MB', 'error');
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

        // Homescreen upload handling
        const homescreenUpload = document.getElementById('homescreenUpload');
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

        // Debug toggle handling
        const debugToggle = document.getElementById('debugToggle');
        debugToggle.addEventListener('change', async (e) => {
            this.debugMode = e.target.checked;
            await this.saveToDB('settings', 'debugMode', this.debugMode);
            this.toggleDebugOverlay(this.debugMode);
        });
    }

    // Save settings
    async saveSettings() {
        try {
            // Save custom prompt
            await this.saveToDB('settings', 'customPrompt', this.customPrompt);
            
            this.showNotification('Settings saved successfully!', 'success');
            this.closeSettingsModal();
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('Error saving settings', 'error');
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 16px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
        `;
        
        switch(type) {
            case 'success':
                notification.style.background = '#10b981';
                notification.style.color = 'white';
                break;
            case 'error':
                notification.style.background = '#ef4444';
                notification.style.color = 'white';
                break;
            default:
                notification.style.background = '#3b82f6';
                notification.style.color = 'white';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
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
