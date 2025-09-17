class BadgeApp {
    constructor() {
        this.dbName = 'BadgeAppDB';
        this.dbVersion = 5; // Increment version to trigger upgrade for dealing position
        this.db = null;
        this.isPositioning = false;
        this.longPressTimeout = null;
        this.dragOffset = { x: 0, y: 0 };
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
                
                // Store for default stack
                if (!db.objectStoreNames.contains('defaultStack')) {
                    db.createObjectStore('defaultStack');
                }
                
                // Store for dealing position
                if (!db.objectStoreNames.contains('dealingPosition')) {
                    db.createObjectStore('dealingPosition');
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

            const savedDefaultStack = await this.getFromDB('defaultStack', 'value');
            if (savedDefaultStack) {
                this.defaultStack = savedDefaultStack;
            }

            const savedDealingPosition = await this.getFromDB('dealingPosition', 'value');
            if (savedDealingPosition) {
                this.dealingPosition = savedDealingPosition;
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
        
        let rightLongPressTimeout;
        
        rightBtn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            rightLongPressTimeout = setTimeout(() => {
                this.showStackSelectionPopup();
            }, 800); // 800ms long press
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
            top: 120px;
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

    // Show stack selection popup
    showStackSelectionPopup() {
        // Remove existing popup if present
        const existing = document.querySelector('.stack-selection-popup');
        if (existing) {
            existing.remove();
        }

        const popup = document.createElement('div');
        popup.className = 'stack-selection-popup';
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
        title.textContent = 'ACAAN Configuration';
        title.style.cssText = 'margin: 0 0 20px 0; color: #333;';

        // Stack selection section
        const stackTitle = document.createElement('h4');
        stackTitle.textContent = 'Default Stack';
        stackTitle.style.cssText = 'margin: 0 0 10px 0; color: #666; font-size: 14px;';

        const stackContainer = document.createElement('div');
        stackContainer.style.cssText = 'margin-bottom: 20px;';

        // Create radio buttons for each stack
        this.stacks.forEach((stackObj, index) => {
            const label = document.createElement('label');
            label.style.cssText = `
                display: block;
                margin: 10px 0;
                padding: 15px;
                border: 2px solid #ddd;
                border-radius: 8px;
                cursor: pointer;
                transition: border-color 0.3s;
            `;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'stack';
            radio.value = stackObj.name;
            radio.checked = this.defaultStack === stackObj.name;
            radio.style.cssText = 'margin-right: 10px;';

            const text = document.createElement('span');
            text.textContent = stackObj.name.charAt(0).toUpperCase() + stackObj.name.slice(1);
            text.style.cssText = 'font-size: 16px;';

            label.appendChild(radio);
            label.appendChild(text);
            
            // Highlight selected option
            if (radio.checked) {
                label.style.borderColor = '#007AFF';
                label.style.backgroundColor = '#f0f8ff';
            }

            label.addEventListener('change', () => {
                // Update styling for all labels
                stackContainer.querySelectorAll('label').forEach(l => {
                    l.style.borderColor = '#ddd';
                    l.style.backgroundColor = 'transparent';
                });
                if (radio.checked) {
                    label.style.borderColor = '#007AFF';
                    label.style.backgroundColor = '#f0f8ff';
                }
            });

            stackContainer.appendChild(label);
        });

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
            const selectedStackRadio = stackContainer.querySelector('input[name="stack"]:checked');
            const selectedDealingRadio = dealingContainer.querySelector('input[name="dealing"]:checked');
            
            if (selectedStackRadio) {
                this.defaultStack = selectedStackRadio.value;
                await this.saveToDB('defaultStack', 'value', this.defaultStack);
            }
            
            if (selectedDealingRadio) {
                this.dealingPosition = selectedDealingRadio.value;
                await this.saveToDB('dealingPosition', 'value', this.dealingPosition);
            }
            
            popup.remove();
            this.showModeNotification(`ACAAN config: ${this.defaultStack} stack, ${this.dealingPosition} dealing`);
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
            }
        });

        // Dealing position section
        const dealingTitle = document.createElement('h4');
        dealingTitle.textContent = 'Dealing Position';
        dealingTitle.style.cssText = 'margin: 0 0 10px 0; color: #666; font-size: 14px;';

        const dealingContainer = document.createElement('div');
        dealingContainer.style.cssText = 'margin-bottom: 20px;';

        // Top dealing option
        const topLabel = document.createElement('label');
        topLabel.style.cssText = `
            display: block;
            margin: 10px 0;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
            transition: border-color 0.3s;
        `;

        const topRadio = document.createElement('input');
        topRadio.type = 'radio';
        topRadio.name = 'dealing';
        topRadio.value = 'top';
        topRadio.checked = this.dealingPosition === 'top';
        topRadio.style.cssText = 'margin-right: 10px;';

        const topText = document.createElement('span');
        topText.textContent = 'Top (Deal from top)';
        topText.style.cssText = 'font-size: 16px;';

        topLabel.appendChild(topRadio);
        topLabel.appendChild(topText);

        // Bottom dealing option
        const bottomLabel = document.createElement('label');
        bottomLabel.style.cssText = `
            display: block;
            margin: 10px 0;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 8px;
            cursor: pointer;
            transition: border-color 0.3s;
        `;

        const bottomRadio = document.createElement('input');
        bottomRadio.type = 'radio';
        bottomRadio.name = 'dealing';
        bottomRadio.value = 'bottom';
        bottomRadio.checked = this.dealingPosition === 'bottom';
        bottomRadio.style.cssText = 'margin-right: 10px;';

        const bottomText = document.createElement('span');
        bottomText.textContent = 'Bottom (Deal from bottom)';
        bottomText.style.cssText = 'font-size: 16px;';

        bottomLabel.appendChild(bottomRadio);
        bottomLabel.appendChild(bottomText);

        // Highlight selected dealing option
        if (topRadio.checked) {
            topLabel.style.borderColor = '#007AFF';
            topLabel.style.backgroundColor = '#f0f8ff';
        }
        if (bottomRadio.checked) {
            bottomLabel.style.borderColor = '#007AFF';
            bottomLabel.style.backgroundColor = '#f0f8ff';
        }

        // Add change listeners for dealing position
        const updateDealingStyles = () => {
            [topLabel, bottomLabel].forEach(l => {
                l.style.borderColor = '#ddd';
                l.style.backgroundColor = 'transparent';
            });
            if (topRadio.checked) {
                topLabel.style.borderColor = '#007AFF';
                topLabel.style.backgroundColor = '#f0f8ff';
            }
            if (bottomRadio.checked) {
                bottomLabel.style.borderColor = '#007AFF';
                bottomLabel.style.backgroundColor = '#f0f8ff';
            }
        };

        topLabel.addEventListener('change', updateDealingStyles);
        bottomLabel.addEventListener('change', updateDealingStyles);

        dealingContainer.appendChild(topLabel);
        dealingContainer.appendChild(bottomLabel);

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(saveBtn);
        modal.appendChild(title);
        modal.appendChild(stackTitle);
        modal.appendChild(stackContainer);
        modal.appendChild(dealingTitle);
        modal.appendChild(dealingContainer);
        modal.appendChild(buttonContainer);
        popup.appendChild(modal);
        document.body.appendChild(popup);
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

    // Card parsing mappings
    getCardMappings() {
        return {
            ranks: {
                'ace': 'a', 'a': 'a', '1': 'a',
                'two': '2', '2': '2',
                'three': '3', '3': '3',
                'four': '4', '4': '4',
                'five': '5', '5': '5',
                'six': '6', '6': '6',
                'seven': '7', '7': '7',
                'eight': '8', '8': '8',
                'nine': '9', '9': '9',
                'ten': '10', '10': '10',
                'jack': 'j', 'j': 'j',
                'queen': 'q', 'q': 'q',
                'king': 'k', 'k': 'k'
            },
            suits: {
                'spades': 's', 'spade': 's', 's': 's',
                'hearts': 'h', 'heart': 'h', 'h': 'h',
                'diamonds': 'd', 'diamond': 'd', 'd': 'd',
                'clubs': 'c', 'club': 'c', 'c': 'c'
            },
            ordinals: {
                'first': 1, '1st': 1,
                'second': 2, '2nd': 2,
                'third': 3, '3rd': 3,
                'fourth': 4, '4th': 4,
                'fifth': 5, '5th': 5,
                'sixth': 6, '6th': 6,
                'seventh': 7, '7th': 7,
                'eighth': 8, '8th': 8,
                'ninth': 9, '9th': 9,
                'tenth': 10, '10th': 10,
                'eleventh': 11, '11th': 11,
                'twelfth': 12, '12th': 12,
                'thirteenth': 13, '13th': 13
            }
        };
    }

    // Parse various card input formats
    parseCardInput(input) {
        console.log('parseCardInput called with:', input);
        const mappings = this.getCardMappings();
        const cleanInput = input.toLowerCase().trim();
        console.log('Clean input:', cleanInput);
        
        // Skip short format detection - only look for full text cards

        // Search for "X of Y" patterns anywhere in the text
        const ofPatterns = [
            /(ace|two|three|four|five|six|seven|eight|nine|ten|jack|queen|king)\s+of\s+(spades?|hearts?|diamonds?|clubs?)/gi
        ];
        
        for (const pattern of ofPatterns) {
            const match = cleanInput.match(pattern);
            if (match) {
                console.log('Found "of" pattern match:', match[0]);
                const cardPhrase = match[0];
                const parsed = this.parseCardComponents(cardPhrase, mappings);
                if (parsed.rank && parsed.suit) {
                    const result = parsed.rank + parsed.suit;
                    console.log('Parsed card from "of" pattern:', result);
                    return result;
                }
            }
        }

        // Check for ordinal patterns (third ace, second king, etc.)
        for (const [ordinalWord, ordinalNum] of Object.entries(mappings.ordinals)) {
            if (cleanInput.includes(ordinalWord)) {
                console.log('Found ordinal:', ordinalWord, ordinalNum);
                // Try to find what comes after the ordinal
                const ordinalIndex = cleanInput.indexOf(ordinalWord);
                const afterOrdinal = cleanInput.substring(ordinalIndex + ordinalWord.length).trim();
                console.log('Text after ordinal:', afterOrdinal);
                
                const parsed = this.parseCardComponents(afterOrdinal, mappings);
                console.log('Parsed components after ordinal:', parsed);
                if (parsed.rank && parsed.suit) {
                    const result = this.findNthCardOfType(parsed.rank + parsed.suit, ordinalNum);
                    console.log('Found nth card of type:', result);
                    return result;
                } else if (parsed.rank) {
                    const result = this.findNthCardOfRank(parsed.rank, ordinalNum);
                    console.log('Found nth card of rank:', result);
                    return result;
                } else if (parsed.suit) {
                    const result = this.findNthCardOfSuit(parsed.suit, ordinalNum);
                    console.log('Found nth card of suit:', result);
                    return result;
                }
                break;
            }
        }

        // Try to parse any rank or suit found in the text
        const parsed = this.parseCardComponents(cleanInput, mappings);
        console.log('Parsed without specific pattern:', parsed);
        if (parsed.rank && parsed.suit) {
            const result = parsed.rank + parsed.suit;
            console.log('Combined rank + suit:', result);
            return result;
        }

        console.log('No match found, returning null');
        return null;
    }

    // Parse card components from input
    parseCardComponents(input, mappings) {
        console.log('parseCardComponents called with:', input);
        let rank = null;
        let suit = null;

        // Handle "X of Y" format
        if (input.includes(' of ')) {
            console.log('Found "of" pattern');
            const parts = input.split(' of ');
            if (parts.length === 2) {
                const rankPart = parts[0].trim();
                const suitPart = parts[1].trim();
                console.log('Rank part:', rankPart, 'Suit part:', suitPart);
                
                rank = mappings.ranks[rankPart];
                suit = mappings.suits[suitPart];
                console.log('Mapped rank:', rank, 'Mapped suit:', suit);
            }
        } else {
            // Check for rank - use word boundaries to avoid partial matches
            for (const [rankWord, rankCode] of Object.entries(mappings.ranks)) {
                // Skip single letter matches to avoid false positives
                if (rankWord.length === 1) continue;
                
                const rankRegex = new RegExp(`\\b${rankWord}\\b`, 'i');
                if (rankRegex.test(input)) {
                    console.log('Found rank match:', rankWord, '->', rankCode);
                    rank = rankCode;
                    break;
                }
            }
            
            // Check for suit - use word boundaries to avoid partial matches
            for (const [suitWord, suitCode] of Object.entries(mappings.suits)) {
                // Skip single letter matches to avoid false positives
                if (suitWord.length === 1) continue;
                
                const suitRegex = new RegExp(`\\b${suitWord}\\b`, 'i');
                if (suitRegex.test(input)) {
                    console.log('Found suit match:', suitWord, '->', suitCode);
                    suit = suitCode;
                    break;
                }
            }
        }

        console.log('Final parsed components:', { rank, suit });
        return { rank, suit };
    }

    // Find nth card of specific type (e.g., third ace of spades)
    findNthCardOfType(cardCode, n) {
        const selectedStack = this.stacks.find(stack => stack.name === this.defaultStack);
        if (!selectedStack) return null;

        let count = 0;
        for (let i = 0; i < selectedStack.stack.length; i++) {
            if (selectedStack.stack[i] === cardCode) {
                count++;
                if (count === n) {
                    return cardCode; // Return the card code for position lookup
                }
            }
        }
        return null;
    }

    // Find nth card of specific rank (e.g., third ace)
    findNthCardOfRank(rank, n) {
        const selectedStack = this.stacks.find(stack => stack.name === this.defaultStack);
        if (!selectedStack) return null;

        let count = 0;
        for (let i = 0; i < selectedStack.stack.length; i++) {
            if (selectedStack.stack[i].startsWith(rank)) {
                count++;
                if (count === n) {
                    return selectedStack.stack[i];
                }
            }
        }
        return null;
    }

    // Find nth card of specific suit (e.g., third spade)
    findNthCardOfSuit(suit, n) {
        const selectedStack = this.stacks.find(stack => stack.name === this.defaultStack);
        if (!selectedStack) return null;

        let count = 0;
        for (let i = 0; i < selectedStack.stack.length; i++) {
            if (selectedStack.stack[i].endsWith(suit)) {
                count++;
                if (count === n) {
                    return selectedStack.stack[i];
                }
            }
        }
        return null;
    }

    // Detect if input is a playing card (updated)
    isPlayingCard(input) {
        return this.parseCardInput(input) !== null;
    }

    // Find card position in selected stack (updated)
    findCardPosition(input) {
        const selectedStack = this.stacks.find(stack => stack.name === this.defaultStack);
        if (!selectedStack) return -1;
        
        const cardCode = this.parseCardInput(input);
        if (!cardCode) return -1;
        
        const zeroBasedPosition = selectedStack.stack.indexOf(cardCode);
        if (zeroBasedPosition === -1) return -1;
        
        // Calculate position based on dealing preference
        if (this.dealingPosition === 'bottom') {
            // When dealing from bottom, reverse the position
            const totalCards = selectedStack.stack.length;
            return totalCards - zeroBasedPosition;
        } else {
            // When dealing from top, use normal position
            return zeroBasedPosition + 1; // Return 1-based position
        }
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
            const isCard = this.isPlayingCard(value);
            console.log('Is playing card:', isCard);
            if (isCard) {
                const position = this.findCardPosition(value);
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
            z-index: 1003;
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
        // Remove existing file input if any
        const existingFileInput = document.querySelector('input[type="file"]');
        if (existingFileInput) {
            existingFileInput.remove();
        }

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.className = 'hidden-file-input';
        fileInput.addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        document.body.appendChild(fileInput);
    }

    // Trigger image upload
    triggerImageUpload() {
        const fileInput = document.querySelector('.hidden-file-input');
        if (fileInput) {
            fileInput.click();
        } else {
            console.error('File input not found');
        }
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