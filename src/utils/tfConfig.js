/**
 * TensorFlow.js Configuration
 * Sets up TensorFlow.js to work within Chrome Extension CSP restrictions
 */

// Configure TensorFlow.js for extension environment
console.log('Configuring TensorFlow.js for extension environment');

// Log TensorFlow readiness state
document.addEventListener('DOMContentLoaded', () => {
    if (window.tf) {
        console.log('TensorFlow.js is available on page load');
        console.log('TensorFlow version:', window.tf.version ? window.tf.version.tfjs : 'unknown');
        
        // Set CPU backend for better extension compatibility
        if (window.tf.setBackend) {
            window.tf.setBackend('cpu').then(() => {
                console.log('Backend set to:', window.tf.getBackend());
                
                // Notify that TensorFlow is ready
                document.dispatchEvent(new CustomEvent('tensorflowjs-ready'));
            });
        }
    } else {
        console.warn('TensorFlow.js not found on page load');
    }
});

// Create a simplified tensor operations module if tf isn't available
if (typeof window.tf === 'undefined') {
    console.warn('Creating placeholder TensorFlow implementation');
    window.tf = {
        version: { tfjs: 'placeholder-1.0.0' },
        tensor2d: (data, shape) => ({ data, shape }),
        dispose: () => {},
        tidy: (fn) => fn(),
        loadLayersModel: async () => {
            throw new Error('TensorFlow.js not available');
        }
    };
}

/**
 * TensorFlow.js Configuration
 * This file sets up the basic configuration for TensorFlow.js
 */

// This will run after tf.js is loaded but before any models are loaded
window.tfConfig = {
  initialized: false,
  
  // Basic configuration for TensorFlow
  setup: async function() {
    try {
      if (!tf) {
        console.error('TensorFlow.js is not loaded yet!');
        return false;
      }
      
      console.log('Setting up TensorFlow.js configuration...');
      
      // Configure TensorFlow.js to use minimal logging
      tf.env().set('DEBUG', false);
      
      // Configure memory usage to be more conservative
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      // tf.env().set('WEBGL_RENDERER', 'webgl2');   // Removed due to unregistered flag
      
      this.initialized = true;
      console.log('TensorFlow.js configuration complete');
      return true;
    } catch (error) {
      console.error('Error setting up TensorFlow.js:', error);
      return false;
    }
  }
};

// Initialize configuration when script loads
document.addEventListener('DOMContentLoaded', () => {
  if (window.tf) {
    window.tfConfig.setup();
  } else {
    console.warn('TensorFlow.js not available yet, will configure when loaded');
  }
});

// Check if TF is already available
if (window.tf) {
  window.tfConfig.setup();
}
