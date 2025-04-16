/**
 * TensorFlow.js loading helper
 * This file ensures TensorFlow.js is properly loaded and initialized
 * before the content script is executed.
 */

console.log('TensorFlow loader initializing...');

// Set a global flag to indicate TensorFlow.js is being loaded
window.__tfLoading = true;

// Function to check if TensorFlow is fully initialized
function checkTensorFlowReady() {
    if (!window.tf) {
        console.error('TensorFlow.js is not available');
        return false;
    }
    
    if (typeof window.tf.loadLayersModel !== 'function') {
        console.error('tf.loadLayersModel is not available');
        return false;
    }
    
    return true;
}

// Log TensorFlow version and backend
function logTensorFlowInfo() {
    if (window.tf) {
        console.log('TensorFlow.js version:', window.tf.version ? window.tf.version.tfjs : 'unknown');
        console.log('TensorFlow.js backend:', window.tf.getBackend ? window.tf.getBackend() : 'unknown');
        
        // List available methods for debugging
        console.log('Available TF methods:', 
            Object.keys(window.tf).filter(key => typeof window.tf[key] === 'function').join(', '));
    }
}

// Initialize TensorFlow backend
async function initializeTensorFlow() {
    try {
        if (window.tf && window.tf.ready) {
            await window.tf.ready();
            console.log('TensorFlow.js backend initialized:', window.tf.getBackend());
        }
    } catch (err) {
        console.warn('Error initializing TensorFlow.js backend:', err);
    }
}

// Global initialization function that the content script can call
window.__initTensorFlow = async function() {
    try {
        if (!checkTensorFlowReady()) {
            console.error('TensorFlow.js not properly loaded');
            return false;
        }
        
        logTensorFlowInfo();
        await initializeTensorFlow();
        
        window.__tfLoading = false;
        window.__tfReady = true;
        
        return true;
    } catch (err) {
        console.error('Error initializing TensorFlow:', err);
        window.__tfLoading = false;
        window.__tfReady = false;
        return false;
    }
};

// Try to initialize right away
document.addEventListener('DOMContentLoaded', () => {
    console.log('TensorFlow loader: DOM ready');
    window.__initTensorFlow();
});

// Set initialization flag after a timeout
setTimeout(() => {
    if (!window.__tfReady) {
        console.log('TensorFlow loader: Initialization timeout');
        window.__initTensorFlow();
    }
}, 1000);

console.log('TensorFlow loader script complete');
