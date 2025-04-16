/**
 * TensorFlow.js WebAssembly Backend Configuration
 * This file configures TensorFlow.js to use the WebAssembly backend
 * instead of the default backend that requires 'unsafe-eval'.
 */

// Initialize TF with WebAssembly backend
async function initTfWasm() {
  try {
    console.log('Initializing TensorFlow.js with WebAssembly backend');
    
    // Check if TensorFlow.js is available
    if (!window.tf) {
      console.error('TensorFlow.js not found. Make sure it is loaded before this script.');
      return false;
    }
    
    // Check if the WASM backend is available
    if (!tf.backend('wasm')) {
      console.error('WASM backend not found. Make sure tf-backend-wasm.min.js is loaded first.');
      return false;
    }
    
    console.log('Setting WASM path...');
    
    // Set the WASM path - needed for the WASM backend to find the .wasm files
    const wasmPath = chrome.runtime.getURL('tfjs-backend-wasm.wasm');
    console.log('WASM path:', wasmPath);
    
    // Register the path to the WASM binary
    if (tf.setWasmPaths) {
      tf.setWasmPaths(chrome.runtime.getURL(''));
    } else {
      console.warn('tf.setWasmPaths not available, using default paths');
    }
    
    // Set backend to WASM
    console.log('Setting backend to WASM...');
    await tf.setBackend('wasm');
    
    // Log the backend to verify
    const backend = tf.getBackend();
    console.log(`TensorFlow.js is using backend: ${backend}`);
    
    if (backend !== 'wasm') {
      console.warn(`Expected 'wasm' backend but got '${backend}'. Fallback might be in use.`);
    }
    
    // Return true if the backend is set to WASM
    return backend === 'wasm';
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js WASM backend:', error);
    return false;
  }
}

// Export the initialization function
window.initTfWasm = initTfWasm;

// Try to initialize right away if TensorFlow is already loaded
if (window.tf) {
  console.log('TensorFlow.js detected, initializing WASM backend immediately');
  window.initTfWasm();
} else {
  console.log('TensorFlow.js not detected, will initialize WASM backend when available');
}
