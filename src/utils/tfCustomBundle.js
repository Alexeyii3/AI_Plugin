import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
// NEW: Import the custom L2 regularizer so it registers with TensorFlow.js
import '../../models/regularizers/L2Regularizer.js';

console.log('TensorFlow.js version:', tf.version.tfjs);

// Set the path for WASM binaries if available
if (tf.setWasmPaths) {
    tf.setWasmPaths(chrome.runtime.getURL(''));
}

window.tf = tf;
export default tf;

console.log('Custom TensorFlow.js bundle loaded');

// Notify the content script that TensorFlow is ready
document.dispatchEvent(new CustomEvent('tensorflowjs-ready'));
