// src/analyzer.js

import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

/**
 * Analyzer Class
 * Handles loading models and classifying text.
 */
class Analyzer {
    constructor() {
        this.useModel = null;
        // this.classifierModel = null;
    }

    /**
     * Loads the Universal Sentence Encoder model.
     * @returns {Promise<void>}
     */
    async loadUSEModel() {
        try {
            this.useModel = await use.load();
            console.log('USE model loaded successfully.');
        } catch (error) {
            console.error('Error loading USE model:', error);
        }
    }

    /**
     * Loads the custom classifier model.
     * @returns {Promise<void>}
     */
    // async loadClassifierModel() {
    //     try {
    //         // The model is located in the 'models/' directory within 'dist/'
    //         const modelURL = chrome.runtime.getURL('models/model.json');
    //         this.classifierModel = await tf.loadLayersModel(modelURL);
    //         console.log('Classifier model loaded successfully.');
    //     } catch (error) {
    //         console.error('Error loading classifier model:', error);
    //     }
    // }

    /**
     * Initializes both models.
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.loadUSEModel();
        // await this.loadClassifierModel();
    }

    /**
     * Classifies the given text into 'title', 'article', or 'random'.
     * @param {string} text - The text to classify.
     * @returns {Promise<string>} - The category of the text.
     */
    async classifyText(text) {
        if (!this.useModel ) {
            console.error('Models are not loaded yet.');
            return 'random';
        }

        try {
            // Generate embeddings
            const embeddings = await this.useModel.embed([text]);
            const embeddingArray = embeddings.arraySync()[0];
            embeddings.dispose(); // Clean up memory

            // Convert embedding to tensor
            const input = tf.tensor2d([embeddingArray]);

            // Get prediction
            const prediction = this.classifierModel.predict(input);
            const predictionData = prediction.dataSync();
            input.dispose();
            prediction.dispose();

            // Determine the category with the highest probability
            const maxIndex = predictionData.indexOf(Math.max(...predictionData));
            const categories = ['title', 'article', 'random'];
            return categories[maxIndex] || 'random';
        } catch (error) {
            console.error('Error during classification:', error);
            return 'random';
        }
    }
}

export default Analyzer;
