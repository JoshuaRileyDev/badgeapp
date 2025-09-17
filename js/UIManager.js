class UIManager {
    constructor(badgeApp) {
        this.app = badgeApp;
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
        input.value = this.app.forceNumber;
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
            this.app.forceNumber = newValue;
            await this.app.db.saveToDB('forceNumber', 'value', newValue);
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
        this.app.stacks.forEach((stackObj, index) => {
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
            radio.checked = this.app.defaultStack === stackObj.name;
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

        // Dealing position section
        const dealingTitle = document.createElement('h4');
        dealingTitle.textContent = 'Dealing Position';
        dealingTitle.style.cssText = 'margin: 0 0 10px 0; color: #666; font-size: 14px;';

        const dealingContainer = document.createElement('div');
        dealingContainer.style.cssText = 'margin-bottom: 20px;';

        // Create dealing position options
        const dealingOptions = [
            { value: 'top', label: 'Top (Deal from top)' },
            { value: 'bottom', label: 'Bottom (Deal from bottom)' }
        ];

        dealingOptions.forEach(option => {
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
            radio.name = 'dealing';
            radio.value = option.value;
            radio.checked = this.app.dealingPosition === option.value;
            radio.style.cssText = 'margin-right: 10px;';

            const text = document.createElement('span');
            text.textContent = option.label;
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
                dealingContainer.querySelectorAll('label').forEach(l => {
                    l.style.borderColor = '#ddd';
                    l.style.backgroundColor = 'transparent';
                });
                if (radio.checked) {
                    label.style.borderColor = '#007AFF';
                    label.style.backgroundColor = '#f0f8ff';
                }
            });

            dealingContainer.appendChild(label);
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
                this.app.defaultStack = selectedStackRadio.value;
                await this.app.db.saveToDB('defaultStack', 'value', this.app.defaultStack);
            }
            
            if (selectedDealingRadio) {
                this.app.dealingPosition = selectedDealingRadio.value;
                await this.app.db.saveToDB('dealingPosition', 'value', this.app.dealingPosition);
            }
            
            popup.remove();
            this.showModeNotification(`ACAAN config: ${this.app.defaultStack} stack, ${this.app.dealingPosition} dealing`);
        });

        popup.addEventListener('click', (e) => {
            if (e.target === popup) {
                popup.remove();
            }
        });

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
}