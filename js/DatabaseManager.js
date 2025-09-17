class DatabaseManager {
    constructor(dbName = 'BadgeAppDB', dbVersion = 5) {
        this.dbName = dbName;
        this.dbVersion = dbVersion;
        this.db = null;
    }

    // Initialize IndexedDB
    async initDB() {
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

    // Save data to IndexedDB
    saveToDB(storeName, key, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data, key);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Get data from IndexedDB
    getFromDB(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Load all saved state from IndexedDB
    async loadSavedState() {
        try {
            const position = await this.getFromDB('capsulePosition', 'position');
            const imageData = await this.getFromDB('homeScreenImage', 'image');
            const savedMode = await this.getFromDB('appMode', 'currentMode');
            const savedForceNumber = await this.getFromDB('forceNumber', 'value');
            const savedDefaultStack = await this.getFromDB('defaultStack', 'value');
            const savedDealingPosition = await this.getFromDB('dealingPosition', 'value');

            return {
                position,
                imageData,
                savedMode,
                savedForceNumber,
                savedDefaultStack,
                savedDealingPosition
            };
        } catch (error) {
            console.error('Error loading saved state:', error);
            return {};
        }
    }

    // Save capsule position
    async savePosition(capsule) {
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

    // Apply saved position to capsule
    applySavedPosition(position) {
        if (!position) return;
        
        const capsule = document.querySelector('.notification-capsule');
        if (capsule) {
            capsule.style.top = position.top;
            capsule.style.left = position.left;
            capsule.style.transform = 'none'; // Remove default centering
        }
    }

    // Apply saved image
    applySavedImage(imageData) {
        if (!imageData) return;
        
        const img = document.querySelector('.fullscreen-image');
        if (img) {
            img.src = imageData;
        }
    }
}