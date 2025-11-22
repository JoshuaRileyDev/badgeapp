class CelebApp {
    constructor() {
        this.dbName = 'CelebSelfieDB';  // Changed to avoid conflict with old BadgeAppDB
        this.dbVersion = 1;
        this.db = null;
        this.userImage = null;
        this.recognition = null;
        this.isListening = false;
        this.debugMode = false;  // Debug mode toggle
        
        // MagicApps API configuration
        this.baseAPI = 'https://api.magicapps.co.uk/api';
        this.appID = 'c6b356d1-d6b4-4ebb-bae2-4b3ba53d71d3';
        this.userID = null;
        this.credits = 0;
        
        // Celebrity list for Fuse.js matching
        this.celebrities = [
            'Tom Cruise', 'Brad Pitt', 'Leonardo DiCaprio', 'Will Smith', 'Johnny Depp',
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
        this.initVoiceRecognition();
        this.createSettingsModal();
        this.createDebugOverlay();
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
            const formData = new FormData();
            formData.append('userID', this.userID);
            formData.append('appID', this.appID);

            const response = await fetch(`${this.baseAPI}/ai-credits/balance`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.type === 'success') {
                this.credits = data.credits;
                this.updateCreditsDisplay();
            } else {
                console.error('Failed to load credits:', data.message);
            }
        } catch (error) {
            console.error('Error loading credits:', error);
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
                this.userImage = savedUserImage;
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
    }

    // Initialize voice recognition
    initVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;  // Enable interim results for debug mode
            this.recognition.lang = 'en-US';
            
            console.log('Voice recognition initialized:', {
                continuous: this.recognition.continuous,
                interimResults: this.recognition.interimResults,
                lang: this.recognition.lang
            });

            this.recognition.onstart = () => {
                this.debugLog('✅ Voice recognition started successfully', 'success');
                this.debugLog(`Settings: interimResults=${this.recognition.interimResults}, lang=${this.recognition.lang}`, 'info');
            };

            this.recognition.onresult = (event) => {
                // Get the last result (most recent)
                const lastResultIndex = event.results.length - 1;
                const transcript = event.results[lastResultIndex][0].transcript;
                const isFinal = event.results[lastResultIndex].isFinal;
                const confidence = event.results[lastResultIndex][0].confidence;
                
                console.log('Voice input:', transcript, 'isFinal:', isFinal, 'confidence:', confidence);
                
                // Always log if debug mode is enabled (check at runtime)
                const confidencePercent = confidence ? (confidence * 100).toFixed(1) : 'N/A';
                this.debugLog(`${isFinal ? '✓ FINAL' : '⋯ interim'}: "${transcript}" (conf: ${confidencePercent}%)`, 'transcript');
                
                if (isFinal) {
                    // Show word count in debug
                    const wordCount = transcript.trim().split(/\s+/).length;
                    this.debugLog(`📝 Received ${wordCount} word(s)`, 'info');
                    this.processCelebrityName(transcript);
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.debugLog(`Error: ${event.error}`, 'error');
                this.isListening = false;
                this.hideBlackOverlay();
            };

            this.recognition.onend = () => {
                this.isListening = false;
                this.debugLog('Voice recognition ended', 'info');
            };
        } else {
            const errorMsg = 'Speech recognition not supported in this browser';
            console.warn(errorMsg);
            this.debugLog(errorMsg, 'error');
        }
    }

    // Handle homescreen tap
    handleHomescreenTap(e) {
        // Create ripple effect
        this.createRipple(e.clientX, e.clientY);

        // Show black overlay and start listening
        this.showBlackOverlay();
        this.startListening();
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

    // Start voice listening
    startListening() {
        if (this.recognition && !this.isListening) {
            this.isListening = true;
            try {
                this.recognition.start();
                console.log('Listening for celebrity name...');
                this.debugLog('🎤 Microphone activated - speak now!', 'info');
            } catch (error) {
                console.error('Failed to start recognition:', error);
                this.debugLog(`Failed to start: ${error.message}`, 'error');
                this.isListening = false;
            }
        } else if (!this.recognition) {
            this.debugLog('Voice recognition not supported', 'error');
        } else if (this.isListening) {
            this.debugLog('Already listening...', 'info');
        }
    }

    // Process celebrity name using Fuse.js
    processCelebrityName(input) {
        this.debugLog(`Processing input: "${input}"`, 'info');
        
        // Clean up the input
        const cleanInput = input.trim();
        
        // Try to find celebrity name within the sentence
        let bestMatch = null;
        let bestScore = 1; // Lower is better in Fuse.js
        
        this.debugLog(`🔍 Searching for celebrity name in input...`, 'info');
        
        // Check each celebrity against the input sentence
        for (const celebrity of this.celebrities) {
            if (cleanInput.toLowerCase().includes(celebrity.toLowerCase())) {
                this.debugLog(`✓ Found exact match: "${celebrity}"`, 'success');
                bestMatch = celebrity;
                bestScore = 0;
                break;
            }
        }
        
        // If no exact match found, try fuzzy matching on the whole input
        if (!bestMatch) {
            this.debugLog(`No exact match found, trying fuzzy search...`, 'info');
        
            // Configure Fuse.js for better name matching
            const fuse = new Fuse(this.celebrities, {
                includeScore: true,
                threshold: 0.4,  // Allow some flexibility for fuzzy matching
                keys: [
                    {
                        name: 'name',
                        getFn: (item) => item
                    }
                ],
                ignoreLocation: true,  // Don't care about position in string
                findAllMatches: true,  // Find all matching patterns
                minMatchCharLength: 3  // Minimum 3 characters to match
            });

            const results = fuse.search(cleanInput);
            
            // Show top 5 matches in debug
            if (this.debugMode && results.length > 0) {
                this.debugLog(`Found ${results.length} potential matches:`, 'info');
                results.slice(0, 5).forEach((result, index) => {
                    this.debugLog(`  ${index + 1}. ${result.item} (score: ${result.score.toFixed(3)})`, 'info');
                });
            }
            
            if (results.length > 0 && results[0].score < 0.5) {
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
            console.log('No celebrity match found for:', input);
            this.debugLog(`❌ No match found in: "${input}"`, 'error');
            this.debugLog('💡 Try saying just the celebrity name (e.g., "Tom Cruise")', 'info');
            this.hideBlackOverlay();
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
            alert('Please upload your image in settings (image needs to be selected each session)');
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
            formData.append('model', 'fofr/face-to-many');
            
            // Add the user image to the images array
            formData.append('images', this.userImage, this.userImage.name);
            
            formData.append('input', JSON.stringify({
                prompt: `a selfie photo with ${celebrityName}, professional photography, high quality, realistic`,
                negative_prompt: 'cartoon, anime, painting, illustration, low quality, blurry',
                num_outputs: 1
            }));
            formData.append('creditCost', '1');

            const response = await fetch(`${this.baseAPI}/ai/replicate`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.type === 'success') {
                // Update credits
                this.credits = data.credits_remaining;
                this.updateCreditsDisplay();
                
                // Display the generated image
                const imageUrl = data.output[0];
                this.displayGeneratedImage(imageUrl);
            } else {
                throw new Error(data.message || 'Failed to generate image');
            }

        } catch (error) {
            console.error('Error generating selfie:', error);
            alert('Error generating image: ' + error.message);
            this.hideBlackOverlay();
        }
    }

    // Display generated image
    displayGeneratedImage(imageUrl) {
        this.hideLoadingMessage();
        
        const img = document.createElement('img');
        img.className = 'generated-image';
        img.src = imageUrl;
        
        const overlay = document.getElementById('blackOverlay');
        overlay.appendChild(img);

        // Trigger animation
        setTimeout(() => {
            img.classList.add('show');
        }, 10);

        // Close on click
        overlay.addEventListener('click', () => {
            img.classList.remove('show');
            setTimeout(() => {
                img.remove();
                this.hideBlackOverlay();
            }, 400);
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
        imageLabel.textContent = 'Your Image';
        imageLabel.style.cssText = 'display: block; margin-bottom: 5px; font-weight: 500;';

        const imageUpload = document.createElement('input');
        imageUpload.type = 'file';
        imageUpload.accept = 'image/*';
        imageUpload.style.cssText = `
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            box-sizing: border-box;
        `;

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
                // Store the file object directly
                this.userImage = file;
                
                // Also save as base64 for preview/persistence
                const reader = new FileReader();
                reader.onload = async (event) => {
                    await this.saveToDB('settings', 'userImagePreview', event.target.result);
                };
                reader.readAsDataURL(file);
            }
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
        debugText.textContent = 'Show voice recognition debug info';
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
        content.appendChild(imageUpload);
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

    // Open settings modal
    async openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.style.display = 'flex';
        
        // Refresh credits when opening settings
        if (this.userID) {
            await this.loadCredits();
        }
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
        title.textContent = '🎤 Voice Debug';
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
            case 'transcript':
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
    new CelebApp();
});
