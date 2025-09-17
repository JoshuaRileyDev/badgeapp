class CardParser {
    constructor() {
        // Card parsing mappings
        this.mappings = {
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
                const parsed = this.parseCardComponents(cardPhrase);
                if (parsed.rank && parsed.suit) {
                    const result = parsed.rank + parsed.suit;
                    console.log('Parsed card from "of" pattern:', result);
                    return result;
                }
            }
        }

        // Check for ordinal patterns (third ace, second king, etc.)
        for (const [ordinalWord, ordinalNum] of Object.entries(this.mappings.ordinals)) {
            if (cleanInput.includes(ordinalWord)) {
                console.log('Found ordinal:', ordinalWord, ordinalNum);
                // Try to find what comes after the ordinal
                const ordinalIndex = cleanInput.indexOf(ordinalWord);
                const afterOrdinal = cleanInput.substring(ordinalIndex + ordinalWord.length).trim();
                console.log('Text after ordinal:', afterOrdinal);
                
                const parsed = this.parseCardComponents(afterOrdinal);
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
        const parsed = this.parseCardComponents(cleanInput);
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
    parseCardComponents(input) {
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
                
                rank = this.mappings.ranks[rankPart];
                suit = this.mappings.suits[suitPart];
                console.log('Mapped rank:', rank, 'Mapped suit:', suit);
            }
        } else {
            // Check for rank - use word boundaries to avoid partial matches
            for (const [rankWord, rankCode] of Object.entries(this.mappings.ranks)) {
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
            for (const [suitWord, suitCode] of Object.entries(this.mappings.suits)) {
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
    findNthCardOfType(cardCode, n, stack) {
        if (!stack) return null;

        let count = 0;
        for (let i = 0; i < stack.length; i++) {
            if (stack[i] === cardCode) {
                count++;
                if (count === n) {
                    return cardCode; // Return the card code for position lookup
                }
            }
        }
        return null;
    }

    // Find nth card of specific rank (e.g., third ace)
    findNthCardOfRank(rank, n, stack) {
        if (!stack) return null;

        let count = 0;
        for (let i = 0; i < stack.length; i++) {
            if (stack[i].startsWith(rank)) {
                count++;
                if (count === n) {
                    return stack[i];
                }
            }
        }
        return null;
    }

    // Find nth card of specific suit (e.g., third spade)
    findNthCardOfSuit(suit, n, stack) {
        if (!stack) return null;

        let count = 0;
        for (let i = 0; i < stack.length; i++) {
            if (stack[i].endsWith(suit)) {
                count++;
                if (count === n) {
                    return stack[i];
                }
            }
        }
        return null;
    }

    // Detect if input is a playing card
    isPlayingCard(input) {
        return this.parseCardInput(input) !== null;
    }

    // Find card position in selected stack with dealing position
    findCardPosition(input, stacks, defaultStack, dealingPosition) {
        const selectedStack = stacks.find(stack => stack.name === defaultStack);
        if (!selectedStack) return -1;
        
        const cardCode = this.parseCardInput(input);
        if (!cardCode) return -1;
        
        const zeroBasedPosition = selectedStack.stack.indexOf(cardCode);
        if (zeroBasedPosition === -1) return -1;
        
        // Calculate position based on dealing preference
        if (dealingPosition === 'bottom') {
            // When dealing from bottom, reverse the position
            const totalCards = selectedStack.stack.length;
            return totalCards - zeroBasedPosition;
        } else {
            // When dealing from top, use normal position
            return zeroBasedPosition + 1; // Return 1-based position
        }
    }
}