/**
 * Module to import TensorFlow.js for use in the extension
 * This version doesn't use eval() and is compatible with CSP
 */

// Import TensorFlow.js - we'll only use CPU and WebGL backends for compatibility
import * as tf from '@tensorflow/tfjs';

// Configure TensorFlow.js for use in extension
(function configureTensorFlow() {
    try {
        // Make TensorFlow available globally
        window.tf = tf;
        
        // Log TensorFlow initialization
        console.log('TensorFlow.js initialized:', tf.version);
        console.log('Available backends:', tf.findBackend ? tf.findBackend() : 'unknown');
        
        // Turn off debug mode
        tf.setDebugMode(false);
        
        // Use CPU backend, which is more compatible with extensions
        if (tf.setBackend) {
            tf.setBackend('cpu').then(() => {
                console.log('TensorFlow.js backend set to:', tf.getBackend());
            }).catch(err => {
                console.warn('Could not set TensorFlow.js backend:', err);
            });
        }
        
        // Event for content script to know when TensorFlow is ready
        document.dispatchEvent(new CustomEvent('tensorflowjs-ready'));
        
    } catch (error) {
        console.error('Error initializing TensorFlow.js module:', error);
    }
})();

export default tf;
