/**
 * Utility to track initialization state across pages using sessionStorage
 */

// Keys for tracking initialization state
const STORAGE_KEYS = {
  TF_INITIALIZED: 'tfjs_initialized',
  MODELS_LOADED: 'ai_models_loaded',
  TOKENIZERS_LOADED: 'ai_tokenizers_loaded'
};

// Check if something is already initialized
export function isInitialized(key) {
  try {
    return sessionStorage.getItem(key) === 'true';
  } catch (e) {
    console.warn('Could not access sessionStorage:', e);
    return false;
  }
}

// Mark something as initialized
export function markAsInitialized(key) {
  try {
    sessionStorage.setItem(key, 'true');
    return true;
  } catch (e) {
    console.warn('Could not write to sessionStorage:', e);
    return false;
  }
}

// Check if TensorFlow.js is already initialized
export function isTensorFlowInitialized() {
  return isInitialized(STORAGE_KEYS.TF_INITIALIZED);
}

// Mark TensorFlow.js as initialized
export function markTensorFlowInitialized() {
  return markAsInitialized(STORAGE_KEYS.TF_INITIALIZED);
}

// Check if AI models are already loaded
export function areModelsLoaded() {
  return isInitialized(STORAGE_KEYS.MODELS_LOADED);
}

// Mark AI models as loaded
export function markModelsLoaded() {
  return markAsInitialized(STORAGE_KEYS.MODELS_LOADED);
}

// Check if tokenizers are already loaded
export function areTokenizersLoaded() {
  return isInitialized(STORAGE_KEYS.TOKENIZERS_LOADED);
}

// Mark tokenizers as loaded
export function markTokenizersLoaded() {
  return markAsInitialized(STORAGE_KEYS.TOKENIZERS_LOADED);
}

// Export all keys for direct usage
export const KEYS = STORAGE_KEYS;
