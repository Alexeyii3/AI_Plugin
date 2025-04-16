/**
 * TensorFlow.js WASM Backend Initialization
 * This module ensures the TensorFlow.js WASM backend is properly initialized
 * before the AI models are loaded, providing better compatibility with
 * environments that restrict eval().
 */

// Define the initialization function in the global scope
window.initTfWasm = async function() {
  try {
    // Check if TensorFlow.js is available
    if (!window.tf) {
      console.error('TensorFlow.js not loaded. Make sure to load it before initializing WASM backend.');
      return false;
    }
    
    // Check if the WASM backend is available
    if (!window.tf.wasm) {
      console.warn('TensorFlow.js WASM backend not available. Make sure @tensorflow/tfjs-backend-wasm is loaded.');
      return false;
    }
    
    console.log('Initializing TensorFlow.js WASM backend...');
    
    // Set WASM path if extension environment
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const wasmPath = chrome.runtime.getURL('');
      console.log('Setting WASM path to:', wasmPath);
      
      // Use the appropriate function based on TF.js version
      if (typeof tf.wasm.setWasmPaths === 'function') {
        tf.wasm.setWasmPaths(wasmPath);
      } else if (typeof tf.setWasmPaths === 'function') {
        tf.setWasmPaths(wasmPath);
      }
    }
    
    // Set the backend to WASM
    console.log('Setting TensorFlow.js backend to WASM...');
    await tf.setBackend('wasm');
    
    // Verify the backend was set correctly
    const backend = tf.getBackend();
    console.log(`Active TensorFlow.js backend: ${backend}`);
    
    if (backend !== 'wasm') {
      console.warn(`Expected WASM backend, but ${backend} is active.`);
      return false;
    }
    
    // Configure WASM thread count if multi-threading is supported
    if (typeof tf.wasm.setThreadsCount === 'function' && typeof navigator !== 'undefined') {
      const numThreads = navigator.hardwareConcurrency ? 
        Math.min(navigator.hardwareConcurrency - 1, 4) : 1;
      
      if (numThreads > 1) {
        console.log(`Configuring WASM to use ${numThreads} threads`);
        tf.wasm.setThreadsCount(numThreads);
      }
    }
    
    console.log('TensorFlow.js WASM backend initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js WASM backend:', error);
    return false;
  }
};

// Also define TF configuration helper for additional settings
window.tfConfig = {
  initialized: false,
  setup: async function() {
    try {
      // Wait for TensorFlow.js to be ready
      await tf.ready();
      
      // Performance optimizations
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Use F16 textures if possible
      tf.env().set('WEBGL_FLUSH_THRESHOLD', 2); // Control automatic GPU flush timing
      tf.env().set('WEBGL_PACK', true); // Enable texture packing 
      
      // Set memory growth to true for more efficient memory usage
      tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 10e6); // Delete textures when exceeding this size
      
      this.initialized = true;
      console.log('TensorFlow.js configuration optimized for performance');
      return true;
    } catch (error) {
      console.error('Error configuring TensorFlow.js:', error);
      return false;
    }
  }
};

// Log when this module is loaded
console.log('TensorFlow.js WASM initialization module loaded and ready');

// Try to initialize right away if TensorFlow.js is already available
if (window.tf) {
  console.log('TensorFlow.js detected, initializing WASM backend immediately');
  window.initTfWasm().then(success => {
    console.log('WASM initialization result:', success ? 'successful' : 'failed');
  });
}
