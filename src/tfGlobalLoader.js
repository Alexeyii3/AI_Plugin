/**
 * TensorFlow Global Loader
 * Ensures TensorFlow.js is loaded only once across the extension
 */

/**
 * Loads TensorFlow.js once and prevents re-initialization
 * @returns {Promise<boolean>} True if successful or already initialized
 */
export async function loadTfOnce() {
    // If already initialized, skip reloading
    if (window.tfInitialized) {
        console.log('TensorFlow.js already initialized; skipping reload.');
        return true;
    }
    
    // Check if TensorFlow.js is available
    if (!window.tf) {
        console.error('TensorFlow.js not loaded yet; ensure tf.js script is included.');
        return false;
    }
    
    console.log('TensorFlow.js loading for the first time...');
    
    try {
        // Perform one-time initialization tasks
        await tf.ready();
        console.log('TensorFlow.js ready with backend:', tf.getBackend());
        
        // Mark as initialized to prevent reinitialization
        window.tfInitialized = true;
        return true;
    } catch (error) {
        console.error('Error initializing TensorFlow.js:', error);
        return false;
    }
}

/**
 * Helper to get information about TensorFlow status
 */
export function getTfStatus() {
    return {
        isInitialized: !!window.tfInitialized,
        isAvailable: !!window.tf,
        backend: window.tf ? tf.getBackend() : null,
        version: window.tf ? tf.version : null
    };
}