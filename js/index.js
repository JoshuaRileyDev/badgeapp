class BadgeApp {
    constructor() {
        this.dbName = 'BadgeAppDB';
        this.dbVersion = 3; // Increment version to trigger upgrade for force number
        this.db = null;
        this.isPositioning = false;
        this.longPressTimeout = null;
        this.dragOffset = { x: 0, y: 0 };
        this.mode = 'add a number'; // Default mode
        this.forceNumber = 1234; // Default force number
        this.inputTimeout = null;
        this.lastInputValue = '';
        
        this.init();
    }

    async init() {
        await this.initDB();
        await this.loadSavedState();
        this.setupEventListeners();
        this.createHiddenButton();
        this.createModeButtons();
        this.createHiddenInput();
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
                
                // Store for capsule position
                if (!db.objectStoreNames.contains('capsulePosition')) {
                    db.createObjectStore('capsulePosition');
                }
                
                // Store for home screen image
                if (!db.objectStoreNames.contains('homeScreenImage')) {
                    db.createObjectStore('homeScreenImage');
                }
                
                // Store for app mode
                if (!db.objectStoreNames.contains('appMode')) {
                    db.createObjectStore('appMode');
                }
                
                // Store for force number
                if (!db.objectStoreNames.contains('forceNumber')) {
                    db.createObjectStore('forceNumber');
                }
            };
        });
    }

    // Load saved state from IndexedDB
    async loadSavedState() {
        try {
            const position = await this.getFromDB('capsulePosition', 'position');
            if (position) {
                const capsule = document.querySelector('.notification-capsule');
                if (capsule) {
                    capsule.style.top = position.top;
                    capsule.style.left = position.left;
                    capsule.style.transform = 'none'; // Remove default centering
                }
            }

            const imageData = await this.getFromDB('homeScreenImage', 'image');
            if (imageData) {
                const img = document.querySelector('.fullscreen-image');
                if (img) {
                    img.src = imageData;
                }
            }

            const savedMode = await this.getFromDB('appMode', 'currentMode');
            if (savedMode) {
                this.mode = savedMode;
            }

            const savedForceNumber = await this.getFromDB('forceNumber', 'value');
            if (savedForceNumber !== undefined) {
                this.forceNumber = savedForceNumber;
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

    // Create hidden button in top right
    createHiddenButton() {
        const hiddenBtn = document.createElement('div');
        hiddenBtn.className = 'hidden-button';
        hiddenBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            background: transparent;
            cursor: pointer;
            z-index: 1000;
            border-radius: 50%;
            transition: background-color 0.3s ease;
        `;
        
        // Long press functionality
        hiddenBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.longPressTimeout = setTimeout(() => {
                this.togglePositionMode();
                hiddenBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }, 800); // 800ms long press
        });

        hiddenBtn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            clearTimeout(this.longPressTimeout);
            if (!this.isPositioning) {
                hiddenBtn.style.backgroundColor = 'transparent';
            }
        });

        hiddenBtn.addEventListener('pointerleave', () => {
            clearTimeout(this.longPressTimeout);
            if (!this.isPositioning) {
                hiddenBtn.style.backgroundColor = 'transparent';
            }
        });

        document.body.appendChild(hiddenBtn);
    }

    // Create mode selection buttons (bottom left, right, and middle - hidden)
    createModeButtons() {
        // Bottom left button - "add a number" mode (tap) / force number (long press)
        const leftBtn = document.createElement('div');
        leftBtn.className = 'mode-button-left';
        leftBtn.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            width: 60px;
            height: 60px;
            background: transparent;
            cursor: pointer;
            z-index: 1000;
            border-radius: 50%;
        `;
        
        let leftLongPressTimeout;
        
        leftBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            leftLongPressTimeout = setTimeout(() => {
                this.showForceNumberPopup();
            }, 800); // 800ms long press
        });

        leftBtn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            clearTimeout(leftLongPressTimeout);
        });

        leftBtn.addEventListener('pointerleave', () => {
            clearTimeout(leftLongPressTimeout);
        });

        leftBtn.addEventListener('click', () => {
            this.setMode('add a number');
        });

        // Bottom right button - "ACAAN" mode
        const rightBtn = document.createElement('div');
        rightBtn.className = 'mode-button-right';
        rightBtn.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: transparent;
            cursor: pointer;
            z-index: 1000;
            border-radius: 50%;
        `;
        
        rightBtn.addEventListener('click', () => {
            this.setMode('ACAAN mode');
        });

        // Bottom middle button - focus input
        const middleBtn = document.createElement('div');
        middleBtn.className = 'mode-button-middle';
        middleBtn.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 60px;
            background: transparent;
            cursor: pointer;
            z-index: 1000;
            border-radius: 50%;
        `;
        
        middleBtn.addEventListener('click', () => {
            this.focusHiddenInput();
        });

        document.body.appendChild(leftBtn);
        document.body.appendChild(rightBtn);
        document.body.appendChild(middleBtn);
    }

    // Set mode and show notification
    async setMode(newMode) {
        if (this.mode === newMode) return; // Don't switch if already in this mode
        
        this.mode = newMode;
        await this.saveToDB('appMode', 'currentMode', newMode);
        this.showModeNotification(newMode);
    }

    // Show mode notification header
    showModeNotification(mode) {
        // Remove existing notification if present
        const existing = document.querySelector('.mode-notification');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.className = 'mode-notification';
        notification.textContent = `Mode: ${mode}`;
        notification.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 12px 24px;
            border-radius: 20px;
            font-size: 16px;
            font-weight: bold;
            z-index: 2000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;

        document.body.appendChild(notification);

        // Fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);

        // Fade out and remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }

    // Show force number popup
    showForceNumberPopup() {
        // Remove existing popup if present
        const existing = document.querySelector('.force-number-popup');
        if (existing) {
            existing.remove();
        }

        const popup = document.createElement('div');
        popup.className = 'force-number-popup';
        popup.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 3000;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 15px;
            padding: 30px;
            width: 280px;
            text-align: center;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Enter Force Number';
        title.style.cssText = 'margin: 0 0 20px 0; color: #333;';

        const input = document.createElement('input');
        input.type = 'number';
        input.value = this.forceNumber;
        input.style.cssText = `
            width: 100%;
            padding: 15px;
            font-size: 18px;
            border: 2px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            box-sizing: border-box;
        `;

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 10px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = `
            flex: 1;
            padding: 15px;
            background: #ccc;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        `;

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save';
        saveBtn.style.cssText = `
            flex: 1;
            padding: 15px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
        `;

        cancelBtn.addEventListener('click', () => {
            popup.remove();
        });

        saveBtn.addEventListener('click', async () => {
            const newValue = parseInt(input.value) || 1234;
            this.forceNumber = newValue;
            await this.saveToDB('forceNumber', 'value', newValue);
            popup.remove();
            this.showModeNotification(`Force number set to ${newValue}`);
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
            }
        });

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(saveBtn);
        modal.appendChild(title);
        modal.appendChild(input);
        modal.appendChild(buttonContainer);
        popup.appendChild(modal);
        document.body.appendChild(popup);

        // Focus the input
        setTimeout(() => input.focus(), 100);
    }

    // Create hidden transparent input
    createHiddenInput() {
        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'hidden-number-input';
        input.style.cssText = `
            position: absolute;
            top: 0;
            left: -9999px;
            width: 1px;
            height: 1px;
            opacity: 0;
            border: none;
            outline: none;
            background: transparent;
            font-size: 16px;
        `;

        input.addEventListener('input', () => {
            this.handleInputChange(input.value);
        });

        document.body.appendChild(input);
    }

    // Focus hidden input
    focusHiddenInput() {
        const input = document.querySelector('.hidden-number-input');
        if (input) {
            input.focus();
            input.value = ''; // Clear previous value
            this.lastInputValue = '';
        }
    }

    // Handle input changes with 3-second delay
    handleInputChange(value) {
        this.lastInputValue = value;
        
        // Clear existing timeout
        if (this.inputTimeout) {
            clearTimeout(this.inputTimeout);
        }

        // Set new timeout for 3 seconds
        this.inputTimeout = setTimeout(() => {
            this.processInput(value);
        }, 3000);
    }

    // Process input and update badge
    processInput(value) {
        if (!value || isNaN(value)) return;

        const inputNumber = parseInt(value);
        const difference = Math.abs(inputNumber - this.forceNumber);
        
        // Update the notification badge
        const capsule = document.querySelector('.notification-capsule');
        if (capsule) {
            capsule.textContent = difference;
        }

        // Clear the hidden input
        const input = document.querySelector('.hidden-number-input');
        if (input) {
            input.value = '';
            input.blur();
        }
        
        this.lastInputValue = '';
    }

    // Toggle positioning mode
    togglePositionMode() {
        this.isPositioning = !this.isPositioning;
        const capsule = document.querySelector('.notification-capsule');
        const hiddenBtn = document.querySelector('.hidden-button');
        
        if (this.isPositioning) {
            capsule.style.cursor = 'move';
            capsule.style.zIndex = '1001';
            hiddenBtn.style.backgroundColor = 'rgba(255, 0, 0, 0.5)';
            this.showExitButton();
            this.showCameraButton();
        } else {
            capsule.style.cursor = 'default';
            capsule.style.zIndex = '';
            hiddenBtn.style.backgroundColor = 'transparent';
            this.hideExitButton();
            this.hideCameraButton();
            this.savePosition();
        }
    }

    // Show exit positioning button
    showExitButton() {
        if (document.querySelector('.exit-positioning')) return;
        
        const exitBtn = document.createElement('button');
        exitBtn.className = 'exit-positioning';
        exitBtn.textContent = '✓ Done';
        exitBtn.style.cssText = `
            position: absolute;
            top: 80px;
            right: 20px;
            padding: 10px 15px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            z-index: 1002;
            font-size: 14px;
        `;
        
        exitBtn.addEventListener('click', () => {
            this.togglePositionMode();
        });
        
        document.body.appendChild(exitBtn);
    }

    // Hide exit positioning button
    hideExitButton() {
        const exitBtn = document.querySelector('.exit-positioning');
        if (exitBtn) {
            exitBtn.remove();
        }
    }

    // Save capsule position to IndexedDB
    async savePosition() {
        const capsule = document.querySelector('.notification-capsule');
        const rect = capsule.getBoundingClientRect();
        
        const position = {
            top: rect.top + 'px',
            left: rect.left + 'px'
        };
        
        try {
            await this.saveToDB('capsulePosition', 'position', position);
        } catch (error) {
            console.error('Error saving position:', error);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        const capsule = document.querySelector('.notification-capsule');
        
        // Touch/mouse events for dragging
        capsule.addEventListener('pointerdown', this.handleDragStart.bind(this));
        document.addEventListener('pointermove', this.handleDragMove.bind(this));
        document.addEventListener('pointerup', this.handleDragEnd.bind(this));
        
        // Create hidden file input (always present but hidden)
        this.createFileInput();
    }

    // Drag functionality
    handleDragStart(e) {
        if (!this.isPositioning) return;
        
        e.preventDefault();
        this.isDragging = true;
        
        const rect = e.target.getBoundingClientRect();
        this.dragOffset.x = e.clientX - rect.left;
        this.dragOffset.y = e.clientY - rect.top;
        
        e.target.style.pointerEvents = 'none';
    }

    handleDragMove(e) {
        if (!this.isDragging || !this.isPositioning) return;
        
        e.preventDefault();
        const capsule = document.querySelector('.notification-capsule');
        
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        
        // Keep within screen bounds
        const maxX = window.innerWidth - capsule.offsetWidth;
        const maxY = window.innerHeight - capsule.offsetHeight;
        
        const clampedX = Math.max(0, Math.min(x, maxX));
        const clampedY = Math.max(0, Math.min(y, maxY));
        
        capsule.style.left = clampedX + 'px';
        capsule.style.top = clampedY + 'px';
        capsule.style.transform = 'none';
    }

    handleDragEnd(e) {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        const capsule = document.querySelector('.notification-capsule');
        capsule.style.pointerEvents = '';
    }

    // Show camera button
    showCameraButton() {
        if (document.querySelector('.change-background-btn')) return;
        
        const changeBtn = document.createElement('button');
        changeBtn.className = 'change-background-btn';
        changeBtn.textContent = '📷';
        changeBtn.style.cssText = `
            position: absolute;
            bottom: 30px;
            right: 30px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 20px;
            cursor: pointer;
            z-index: 999;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        changeBtn.addEventListener('click', () => {
            this.triggerImageUpload();
        });
        
        document.body.appendChild(changeBtn);
    }

    // Hide camera button
    hideCameraButton() {
        const changeBtn = document.querySelector('.change-background-btn');
        if (changeBtn) {
            changeBtn.remove();
        }
    }

    // Create hidden file input (always present)
    createFileInput() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });
        
        document.body.appendChild(fileInput);
    }

    // Trigger image upload
    triggerImageUpload() {
        const fileInput = document.querySelector('input[type="file"]');
        fileInput.click();
    }

    // Handle image upload
    handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const imageData = event.target.result;
            
            // Update the image
            const img = document.querySelector('.fullscreen-image');
            img.src = imageData;
            
            // Save to IndexedDB
            try {
                await this.saveToDB('homeScreenImage', 'image', imageData);
            } catch (error) {
                console.error('Error saving image:', error);
            }
        };
        
        reader.readAsDataURL(file);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BadgeApp();
});