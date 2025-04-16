/**
 * TensorFlow.js Configuration Wrapper
 * Ensures configuration is only done once per session
 */

import { isTensorFlowInitialized, markTensorFlowInitialized } from './sessionStorageUtil.js';

// The original TF configuration function from aiAnalyzerInit.js
async function configureBackend() {
  if (!window.tf) {
    console.error('TensorFlow.js not loaded');
    return false;
  }
  
  try {
    console.log('Setting up TensorFlow.js configuration once for this session...');
    await tf.ready();
    
    // Get the current backend
    const backend = tf.getBackend();
    console.log(`Configuring for backend: ${backend}`);
    
    // Performance optimizations based on available backend
    if (backend === 'webgl') {
      // WebGL specific optimizations
      tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      tf.env().set('WEBGL_FLUSH_THRESHOLD', 2);
      tf.env().set('WEBGL_PACK', true);
      tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 10e6);
    } else if (backend === 'wasm') {
      // WASM specific optimizations if needed
    }
    
    console.log('TensorFlow.js configuration complete');
    return true;
  } catch (error) {
    console.error('Error configuring TensorFlow.js:', error);
    return false;
  }
}

// Wrapped configuration function with session checking
export async function setupTensorFlow() {
  if (isTensorFlowInitialized()) {
    console.log('TensorFlow.js already configured in this session');
    return true;
  }
  
  const success = await configureBackend();
  if (success) {
    markTensorFlowInitialized();
  }
  return success;
}
