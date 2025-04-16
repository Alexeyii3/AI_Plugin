/**
 * Model loader utility for browser extension
 * Handles loading TensorFlow.js models and tokenizers
 */

class ModelLoader {
    constructor() {
        this.model = null;
        this.tokenizer = null;
        this.isLoading = false;
    }

    /**
     * Check if TensorFlow.js is available and properly loaded
     * @returns {boolean} - Whether TensorFlow.js is available
     */
    isTensorFlowAvailable() {
        return typeof window.tf !== 'undefined';
    }

    /**
     * Load model from extension resource
     * @param {string} modelPath - Path to model.json file
     * @returns {Promise<tf.LayersModel>}
     */
    async loadModel(modelPath) {
        if (this.model) {
            return this.model;
        }

        if (this.isLoading) {
            // Wait for existing loading process to complete
            while (this.isLoading) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return this.model;
        }

        this.isLoading = true;

        try {
            // Check if TensorFlow.js is available
            if (!this.isTensorFlowAvailable()) {
                throw new Error('TensorFlow.js is not available. Make sure it was properly injected by the extension.');
            }

            // Create full URL for the model
            const modelUrl = chrome.runtime.getURL(modelPath);
            console.log('Loading model from:', modelUrl);

            // Load the model
            this.model = await window.tf.loadLayersModel(modelUrl);
            console.log('Model loaded successfully');
            
            this.isLoading = false;
            return this.model;
        } catch (error) {
            console.error('Error loading model:', error);
            this.isLoading = false;
            throw error;
        }
    }

    /**
     * Load tokenizer from extension resource
     * @param {string} tokenizerPath - Path to tokenizer JSON file
     * @returns {Promise<Object>}
     */
    async loadTokenizer(tokenizerPath) {
        if (this.tokenizer) {
            return this.tokenizer;
        }

        try {
            // Fetch the tokenizer file
            const tokenizerUrl = chrome.runtime.getURL(tokenizerPath);
            console.log('Loading tokenizer from:', tokenizerUrl);
            
            const response = await fetch(tokenizerUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch tokenizer: ${response.status}`);
            }
            
            const wordIndex = await response.json();
            
            this.tokenizer = {
                word_index: wordIndex,
                oov_token: '<UNK>',
                max_len: 30
            };
            
            console.log('Tokenizer loaded successfully');
            return this.tokenizer;
        } catch (error) {
            console.error('Error loading tokenizer:', error);
            throw error;
        }
    }

    /**
     * Process text to sequence using loaded tokenizer
     * @param {string} text - Input text
     * @param {number} maxLen - Maximum sequence length
     * @returns {number[]} - Tokenized sequence
     */
    textToSequence(text, maxLen) {
        if (!this.tokenizer || !this.tokenizer.word_index) {
            console.error('Tokenizer not loaded');
            return Array(maxLen || 30).fill(0);
        }

        // Clean text
        const cleaned = text.toLowerCase()
            .replace(/<[^>]+>/g, '')  // Remove HTML tags
            .replace(/[^\w\s]/g, ' ')  // Remove punctuation
            .replace(/\s+/g, ' ').trim();  // Normalize whitespace
            
        const words = cleaned.split(' ');
        
        // Get OOV index or use default of 1
        const oovIndex = this.tokenizer.word_index['<UNK>'] || 1;
        
        // Convert words to token IDs
        const sequence = words.map(word => 
            this.tokenizer.word_index[word] || oovIndex
        );
        
        // Pad or truncate sequence to maxLen
        const finalMaxLen = maxLen || this.tokenizer.max_len || 30;
        if (sequence.length > finalMaxLen) {
            return sequence.slice(0, finalMaxLen);
        } else {
            return [...sequence, ...Array(finalMaxLen - sequence.length).fill(0)];
        }
    }

    /**
     * Predict using loaded model
     * @param {string} text - Input text
     * @returns {Promise<Object>} - Prediction result
     */
    async predict(text) {
        if (!this.model || !this.tokenizer) {
            throw new Error('Model or tokenizer not loaded');
        }

        try {
            // Process text to sequence
            const sequence = this.textToSequence(text);
            
            // Create tensor
            const inputTensor = window.tf.tensor2d([sequence], [1, sequence.length]);
            
            // Run prediction
            const prediction = this.model.predict(inputTensor);
            const score = prediction.dataSync()[0];
            
            // Clean up tensor resources
            window.tf.dispose([inputTensor, prediction]);
            
            return {
                probability: score,
                isClickbait: score > 0.5
            };
        } catch (error) {
            console.error('Prediction error:', error);
            throw error;
        }
    }
}

// Export the loader
const modelLoader = new ModelLoader();
