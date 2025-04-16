/**
 * Text preprocessing utilities for model inference
 */

// Text cleaning function
function cleanText(text) {
    return text.toLowerCase()
        .replace(/<[^>]+>/g, '')  // Remove HTML tags
        .replace(/[^\w\s]/g, ' ')  // Remove punctuation
        .replace(/\s+/g, ' ').trim();  // Normalize whitespace
}

/**
 * Text tokenization function
 * @param {string} text - Input text
 * @param {Object} tokenizer - Tokenizer with word_index
 * @param {number} maxLen - Maximum sequence length
 * @returns {number[]} - Tokenized sequence
 */
function textToSequence(text, tokenizer, maxLen = 30) {
    if (!tokenizer || !tokenizer.word_index) {
        console.error('Invalid tokenizer provided');
        return Array(maxLen).fill(0);
    }

    const cleaned = cleanText(text);
    const words = cleaned.split(' ');
    
    // Get OOV index or use default of 1
    const oovIndex = tokenizer.word_index['<UNK>'] || tokenizer.word_index['<OOV>'] || 1;
    
    // Convert words to token IDs
    const sequence = words.map(word => 
        tokenizer.word_index[word] || oovIndex
    );
    
    // Pad or truncate sequence to maxLen
    if (sequence.length > maxLen) {
        return sequence.slice(0, maxLen);
    } else {
        return [...sequence, ...Array(maxLen - sequence.length).fill(0)];
    }
}

/**
 * Batch tokenization for multiple texts
 * @param {string[]} texts - Array of input texts
 * @param {Object} tokenizer - Tokenizer with word_index
 * @param {number} maxLen - Maximum sequence length
 * @returns {number[][]} - Array of tokenized sequences
 */
function batchTokenize(texts, tokenizer, maxLen = 30) {
    return texts.map(text => textToSequence(text, tokenizer, maxLen));
}

// Export the functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cleanText,
        textToSequence,
        batchTokenize
    };
}
