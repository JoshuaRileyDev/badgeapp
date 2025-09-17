class BadgeApp {
    constructor() {
        // Core properties
        this.isPositioning = false;
        this.longPressTimeout = null;
        this.dragOffset = { x: 0, y: 0 };
        this.isDragging = false;
        this.mode = 'add a number'; // Default mode
        this.forceNumber = 1234; // Default force number
        this.inputTimeout = null;
        this.lastInputValue = '';
        
        // Stacks data structure
        this.stacks = [
            {
                name: 'mnemonica',
                stack: [
                    'as', '2s', '3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', 'js', 'qs', 'ks',
                    'ah', '2h', '3h', '4h', '5h', '6h', '7h', '8h', '9h', '10h', 'jh', 'qh', 'kh',
                    'ad', '2d', '3d', '4d', '5d', '6d', '7d', '8d', '9d', '10d', 'jd', 'qd', 'kd',
                    'ac', '2c', '3c', '4c', '5c', '6c', '7c', '8c', '9c', '10c', 'jc', 'qc', 'kc'
                ]
            }
        ];
        this.defaultStack = 'mnemonica'; // Default selected stack
        this.dealingPosition = 'top'; // Default dealing position (top or bottom)
        
        // Initialize managers
        this.db = new DatabaseManager();
        this.cardParser = new CardParser();
        this.ui = new UIManager(this);
        
        this.init();
    }

    async init() {
        await this.db.initDB();
        await this.loadSavedState();
        this.setupEventListeners();
        this.createHiddenButton();
        this.createModeButtons();
        this.createHiddenInput();
    }

    // Load saved state from database
    async loadSavedState() {
        const state = await this.db.loadSavedState();
        
        // Apply saved position
        this.db.applySavedPosition(state.position);
        
        // Apply saved image
        this.db.applySavedImage(state.imageData);
        
        // Apply saved mode
        if (state.savedMode) {
            this.mode = state.savedMode;
        }

        // Apply saved force number
        if (state.savedForceNumber !== undefined) {
            this.forceNumber = state.savedForceNumber;
        }

        // Apply saved default stack
        if (state.savedDefaultStack) {
            this.defaultStack = state.savedDefaultStack;
        }

        // Apply saved dealing position
        if (state.savedDealingPosition) {
            this.dealingPosition = state.savedDealingPosition;
        }
    }

    // Create hidden button in top right
    createHiddenButton() {
        const hiddenBtn = document.createElement('div');
        hiddenBtn.className = 'hidden-button';
        hiddenBtn.style.cssText = `
            position: absolute;
            top: 40px;
            right: 20px;
            width: 70px;
            height: 70px;
            background: transparent;
            cursor: pointer;
            z-index: 1000;
            border-radius: 0;
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

    // Create mode selection buttons (bottom left, right, and middle)
    createModeButtons() {
        // Bottom left button - "add a number" mode (tap) / force number (long press)
        const leftBtn = this.createButton('mode-button-left', 20, 20, 'left');
        
        let leftLongPressTimeout;
        
        leftBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            leftLongPressTimeout = setTimeout(() => {
                this.ui.showForceNumberPopup();
            }, 800);
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

        // Bottom right button - "ACAAN" mode (tap) / stack selection (long press)
        const rightBtn = this.createButton('mode-button-right', 20, 20, 'right');
        
        let rightLongPressTimeout;
        
        rightBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            rightLongPressTimeout = setTimeout(() => {
                this.ui.showStackSelectionPopup();
            }, 800);
        });

        rightBtn.addEventListener('pointerup', (e) => {
            e.preventDefault();
            clearTimeout(rightLongPressTimeout);
        });

        rightBtn.addEventListener('pointerleave', () => {
            clearTimeout(rightLongPressTimeout);
        });

        rightBtn.addEventListener('click', () => {
            this.setMode('ACAAN mode');
        });

        // Bottom middle button - focus input
        const middleBtn = this.createButton('mode-button-middle', 20, '50%', 'middle');
        middleBtn.style.transform = 'translateX(-50%)';
        
        middleBtn.addEventListener('click', () => {
            this.focusHiddenInput();
        });
    }

    // Helper to create buttons
    createButton(className, bottom, position, side) {
        const btn = document.createElement('div');
        btn.className = className;
        btn.style.cssText = `
            position: absolute;
            bottom: ${bottom}px;
            ${side === 'middle' ? 'left' : side}: ${position === '50%' ? position : position + 'px'};
            width: 60px;
            height: 60px;
            background: transparent;
            cursor: pointer;
            z-index: 1000;
            border-radius: 50%;
        `;
        
        document.body.appendChild(btn);
        return btn;
    }

    // Set mode and show notification
    async setMode(newMode) {
        if (this.mode === newMode) return;
        
        this.mode = newMode;
        await this.db.saveToDB('appMode', 'currentMode', newMode);
        this.ui.showModeNotification(newMode);
    }

    // Create hidden transparent input
    createHiddenInput() {
        const input = document.createElement('input');
        input.type = 'text'; // Changed to text to accept card inputs
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
            if (this.mode === 'ACAAN mode') {
                // For ACAAN mode, process immediately without delay
                this.processInput(input.value);
            } else {
                // For other modes, use the 3-second delay
                this.handleInputChange(input.value);
            }
        });

        document.body.appendChild(input);
    }

    // Focus hidden input
    focusHiddenInput() {
        const input = document.querySelector('.hidden-number-input');
        if (input) {
            input.focus();
            input.value = '';
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
        console.log('processInput called with:', value, 'mode:', this.mode);
        if (!value) return;

        const capsule = document.querySelector('.notification-capsule');
        if (!capsule) return;

        if (this.mode === 'ACAAN mode') {
            console.log('Processing in ACAAN mode');
            // Check if input is a playing card
            const isCard = this.cardParser.isPlayingCard(value);
            console.log('Is playing card:', isCard);
            if (isCard) {
                const position = this.cardParser.findCardPosition(value, this.stacks, this.defaultStack, this.dealingPosition);
                console.log('Card position found:', position);
                if (position !== -1) {
                    capsule.textContent = position;
                    console.log('Updated badge to:', position);
                } else {
                    capsule.textContent = 'N/A';
                    console.log('Updated badge to: N/A');
                }
            } else {
                console.log('Not a valid card, not updating badge');
                return;
            }
        } else if (this.mode === 'add a number') {
            console.log('Processing in add a number mode');
            // Original number mode
            if (isNaN(value)) return;
            const inputNumber = parseInt(value);
            const difference = Math.abs(inputNumber - this.forceNumber);
            capsule.textContent = difference;
            console.log('Updated badge to difference:', difference);
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

    // Save capsule position
    async savePosition() {
        const capsule = document.querySelector('.notification-capsule');
        await this.db.savePosition(capsule);
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
                await this.db.saveToDB('homeScreenImage', 'image', imageData);
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