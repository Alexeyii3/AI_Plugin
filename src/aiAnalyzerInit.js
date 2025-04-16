/**
 * AI Analyzer Initialization
 * This file loads and initializes the AI models for text analysis from both fake news and clickbait models
 */

import { 
  processFakeNewsInput, 
  processClickbaitInput, 
  loadTokenizer,
  loadSourceEncoder,
  loadClickbaitTokenizer 
} from './utils/tokenizationUtils.js';
import { loadTfOnce } from './tfGlobalLoader.js';
import { isTensorFlowInitialized } from './sessionStorageUtil.js';

// Define TF WASM initialization function in the global scope
window.initTfWasm = async function() {
  // Before configuring WASM or switching backends, ensure TF loads only once
  await loadTfOnce();
  if (window.tfInitialized !== true) return false;

  try {
    // Check if TensorFlow.js is available
    if (!window.tf) {
      console.error('TensorFlow.js not loaded. Make sure to load it before initializing WASM backend.');
      return false;
    }
    
    console.log('TensorFlow.js version:', tf.version);
    
    // Check how we can access the WASM backend (different TF.js versions have different APIs)
    let wasmBackendAvailable = false;
    
    // Check all possible ways the WASM backend might be available
    if (tf.wasm) {
      console.log('tf.wasm namespace is available');
      wasmBackendAvailable = true;
    } else if (tf.backend && typeof tf.backend === 'function' && tf.backend('wasm')) {
      console.log('wasm backend is available through tf.backend() function');
      wasmBackendAvailable = true;
    } else if (tf.findBackend && typeof tf.findBackend === 'function' && tf.findBackend('wasm')) {
      console.log('wasm backend is available through tf.findBackend() function');
      wasmBackendAvailable = true;
    } else {
      // Try to register the backend if available in tf.wasm
      try {
        // This works for some TF.js versions
        await tf.ready();
        if (tf.backend() === 'wasm') {
          console.log('WASM backend is already the active backend');
          wasmBackendAvailable = true;
        }
      } catch (e) {
        console.warn('Error checking backend readiness:', e);
      }
    }
    
    if (!wasmBackendAvailable) {
      console.warn('TensorFlow.js WASM backend not available. Falling back to default backend.');
      return false;
    }
    
    console.log('Initializing TensorFlow.js WASM backend...');
    
    // Set WASM path if extension environment
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const wasmPath = chrome.runtime.getURL('');
      console.log('Setting WASM path to:', wasmPath);
      
      // Use the appropriate function based on TF.js version
      if (tf.wasm && typeof tf.wasm.setWasmPaths === 'function') {
        tf.wasm.setWasmPaths(wasmPath);
      } else if (typeof tf.setWasmPaths === 'function') {
        tf.setWasmPaths(wasmPath);
      }
    }
    
    try {
      // Set the backend to WASM
      console.log('Setting TensorFlow.js backend to WASM...');
      await tf.setBackend('wasm');
      
      // Make sure TF is ready (will complete backend initialization)
      await tf.ready();
      
      // Verify the backend was set correctly
      const backend = tf.getBackend();
      console.log(`Active TensorFlow.js backend: ${backend}`);
      
      if (backend !== 'wasm') {
        console.warn(`Expected WASM backend, but ${backend} is active. Will continue with ${backend} backend.`);
      }
      
      // Configure WASM thread count if multi-threading is supported and wasm is active
      if (backend === 'wasm' && tf.wasm && typeof tf.wasm.setThreadsCount === 'function' && typeof navigator !== 'undefined') {
        const numThreads = navigator.hardwareConcurrency ? 
          Math.min(navigator.hardwareConcurrency - 1, 4) : 1;
        
        if (numThreads > 1) {
          console.log(`Configuring WASM to use ${numThreads} threads`);
          tf.wasm.setThreadsCount(numThreads);
        }
      }
      
      // Even if it's not WASM, we've successfully set up a backend
      console.log('TensorFlow.js backend initialized successfully');
      return true;
    } catch (backendError) {
      console.error('Failed to set WASM backend:', backendError);
      console.log('Continuing with default backend');
      return false;
    }
  } catch (error) {
    console.error('Failed to initialize TensorFlow.js backend:', error);
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
      
      this.initialized = true;
      console.log('TensorFlow.js configuration optimized for performance');
      return true;
    } catch (error) {
      console.error('Error configuring TensorFlow.js:', error);
      return false;
    }
  }
};

window.aiAnalyzer = {
  models: {}, // store both models: fakeNews and clickbait
  tokenizers: {},
  initialized: false,
  _initializing: false, // Add initialization tracking flag
  debugLogs: {
    fakeNews: [],
    clickbait: []
  },
  
  // Add a recent results tracker
  recentAnalyses: [],
  
  // Wait for TensorFlow.js to be available
  waitForTensorFlow: async function(maxWaitTime = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkTF = () => {
        if (window.tf) {
          // Extra verification that TF is actually loaded and functional
          try {
            // Simple operation to verify TF is working
            const tensor = tf.tensor([1, 2, 3]);
            tensor.dispose();
            console.log('TensorFlow.js is fully loaded and functional');
            resolve(true);
          } catch (e) {
            console.warn('TensorFlow.js is present but not fully functional:', e);
            
            const elapsedTime = Date.now() - startTime;
            if (elapsedTime > maxWaitTime) {
              console.error(`Timed out waiting for functional TensorFlow.js after ${maxWaitTime}ms`);
              resolve(false);
            } else {
              setTimeout(checkTF, 100);
            }
          }
          return;
        }
        
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > maxWaitTime) {
          console.error(`Timed out waiting for TensorFlow.js after ${maxWaitTime}ms`);
          resolve(false);
          return;
        }
        
        setTimeout(checkTF, 100);
      };
      
      checkTF();
    });
  },
  
  // Initialize the analyzer and load both models and tokenizers
  initialize: async function() {
    try {
      if (this.initialized && this.models.fakeNews && this.models.clickbait) {
        return true;
      }
      
      // First, make sure TensorFlow.js is available and functional
      const tfAvailable = await this.waitForTensorFlow();
      if (!tfAvailable) {
        throw new Error('TensorFlow.js could not be loaded or is not functional');
      }
      
      // Set a flag to track initialization status
      this._initializing = true;
      
      console.log('TensorFlow.js is ready, initializing backend...');
      
      // Skip WASM initialization and directly use WebGL
      try {
        // Set WebGL as the preferred backend
        await tf.setBackend('webgl');
        await tf.ready();
        const backend = tf.getBackend();
        console.log(`Using TensorFlow.js backend: ${backend}`);
        
        // Apply WebGL-specific optimizations
        if (backend === 'webgl') {
          tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
          tf.env().set('WEBGL_FLUSH_THRESHOLD', 2);
          tf.env().set('WEBGL_PACK', true);
          tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 10e6);
          console.log('WebGL backend optimizations applied');
        }
      } catch (backendError) {
        console.error('Failed to set WebGL backend:', backendError);
        // Continue anyway with whatever backend is available
        console.log(`Using default backend: ${tf.getBackend()}`);
      }
      
      // IMPORTANT: Load tokenizers FIRST to ensure they're available before model usage
      this.tokenizers.fakeNewsText = await loadTokenizer('fake_news_model/tokenizer.json');
      
      // Add more robust source encoder loading with validation
      const sourceEncoder = await loadSourceEncoder('fake_news_model/source_encoder.json');
      // Validate the source encoder explicitly 
      if (!sourceEncoder || !sourceEncoder.source_to_index || 
          Object.keys(sourceEncoder.source_to_index).length === 0) {
        
        console.error('Source encoder validation failed:', sourceEncoder);
        throw new Error('Source encoder not properly loaded');
      }
      
      console.log('Source encoder loaded successfully with', 
                  Object.keys(sourceEncoder.source_to_index).length, 
                  'entries');
      this.tokenizers.fakeNewsSource = sourceEncoder;
      
      this.tokenizers.clickbait = await loadClickbaitTokenizer(
        'tfjs_clickbait_model/word_index.json',
        'tfjs_clickbait_model/tokenizer_config.json'
      );
      
      // Still do the general validation
      if (!this.tokenizers.fakeNewsText || !this.tokenizers.fakeNewsSource || !this.tokenizers.clickbait) {
        throw new Error('Failed to load one or more tokenizers');
      }
      
      // Load models AFTER tokenizers
      
      // Load fake news model
      const fakeNewsModelUrl = chrome.runtime.getURL('models/fake_news_model/model.json');
      this.models.fakeNews = await tf.loadLayersModel(fakeNewsModelUrl);
      
      // Load clickbait model
      const clickbaitModelUrl = chrome.runtime.getURL('models/tfjs_clickbait_model/model.json');
      this.models.clickbait = await tf.loadLayersModel(clickbaitModelUrl);
      
      // Get embedding dimensions from models
      try {
        // Extract fake news model configuration
        const textEmbeddingLayer = this.models.fakeNews.layers.find(l => l.name === "text_embedding");
        this.fakeNewsTextVocabSize = textEmbeddingLayer ? textEmbeddingLayer.getConfig().inputDim : 20000;
        
        const sourceEmbeddingLayer = this.models.fakeNews.layers.find(l => l.name === "source_embedding");
        this.fakeNewsSourceVocabSize = sourceEmbeddingLayer ? sourceEmbeddingLayer.getConfig().inputDim : 2031;
        
        // Extract clickbait model configuration
        const clickbaitEmbeddingLayer = this.models.clickbait.layers.find(l => l.name.includes("embedding"));
        this.clickbaitVocabSize = clickbaitEmbeddingLayer ? clickbaitEmbeddingLayer.getConfig().inputDim : 10000;
      } catch (configError) {
        console.warn('Could not extract model configuration:', configError);
      }
      
      // Set initialized flag only after everything is loaded
      this.initialized = true;
      this._initializing = false;
      
      // Dispatch a custom event to notify that the analyzer is ready
      document.dispatchEvent(new CustomEvent('ai-analyzer-ready', { 
        detail: { success: true } 
      }));
      
      return true;
    } catch (error) {
      console.error('Error initializing AI analyzer:', error);
      this.initialized = false;
      this._initializing = false;
      
      // Dispatch event even on failure so listeners can respond
      document.dispatchEvent(new CustomEvent('ai-analyzer-ready', { 
        detail: { success: false, error: error.message } 
      }));
      
      return false;
    }
  },
  
  // Helper function to check if analyzer is ready for use
  isReady: async function() {
    // If TensorFlow is already initialized in this session and our models exist, 
    // skip backend initialization entirely
    if (isTensorFlowInitialized() && 
        this.initialized && 
        this.models.fakeNews && 
        this.models.clickbait) {
      console.log('AI analyzer already initialized in this session - using existing instance');
      return true;
    }
    
    // If currently initializing, wait for it to finish
    if (this._initializing) {
      console.log('AI analyzer initialization already in progress, waiting...');
      return new Promise(resolve => {
        document.addEventListener('ai-analyzer-ready', (event) => {
          resolve(event.detail.success);
        }, { once: true });
      });
    }
    
    // Not initialized and not initializing, start initialization
    console.log('Starting new AI analyzer initialization');
    return await this.initialize();
  },

  async newsMakePrediction(tensorNews, tensorSource) {
    const prediction = await this.models.fakeNews.predict([tensorNews, tensorSource]);
    const data = await prediction.dataSync();
    return data;
  },
  
  // Analyze a single text string using both models
  analyzeText: async function(text) {
    // First, ensure everything is initialized
    if (!this.initialized || !this.models.fakeNews || !this.models.clickbait || 
        !this.tokenizers.fakeNewsText || !this.tokenizers.fakeNewsSource || !this.tokenizers.clickbait) {
      console.warn('Models or tokenizers not initialized, initializing now...');
      const success = await this.initialize();
      if (!success) {
        console.error('Failed to initialize, returning fallback results');
        return {
          fakeNews: { label: 'LABEL_0', score: 0.5 },
          clickbait: { label: 'LABEL_0', score: 0.5 }
        };
      }
    }
    
    // Default results in case of failure
    let fakeNewsResult = { label: 'LABEL_1', score: 0.5 };  // Default to 'verified' for fake news
    let clickbaitResult = { label: 'LABEL_1', score: 0.5 }; // Default to 'verified' for clickbait
    
    let fakeNewsInputs, clickbaitInput;
    let domainToken = 0; // Add this variable declaration at the top level of the function

    try {
      // Get the current website domain for the fake news model
      const currentDomain = this.extractBaseDomain(window.location.href);
      
      // Run fake news model
      try {
        // Process inputs for fake news model
        fakeNewsInputs = await processFakeNewsInput(
          text, 
          currentDomain,
          300,
          30
        );
        

        const textTensor = tf.tensor2d([fakeNewsInputs.textSequence], [1, 300]);


        domainToken = fakeNewsInputs.sourceSequence[0] || 0; // Store the domain token
        const sourceTensor = tf.tensor2d([[domainToken]], [1,1]);
        
        // // Get prediction
        // const fakeNewsData = await tf.tidy(() => {
        //   // Check if model exists and is callable
        //   if (!this.models.fakeNews || typeof this.models.fakeNews.predict !== 'function') {
        //     throw new Error("Fake news model is not properly loaded or predict is not a function");
        //   }
          
        //   const prediction = this.models.fakeNews.predict([textTensor, sourceTensor]);
          
        //   // Extract data
        //   return prediction.dataSync();
        // });

        const fakeNewsData = await this.newsMakePrediction(textTensor, sourceTensor);
        
        // Create result object
        const rawProb = fakeNewsData[0];

        // FIXED: Correct label assignment - score > 0.5 means verified (LABEL_1)
        fakeNewsResult = {
          label: rawProb > 0.5 ? 'LABEL_1' : 'LABEL_0',
          score: rawProb > 0.5 ? rawProb : 1 - rawProb,
          rawProbability: rawProb
        };
        
        if (this.debugLogs.fakeNews.length < 10) {
          this.debugLogs.fakeNews.push({
            textSample: text.slice(0, 60),
            textTokens: fakeNewsInputs.textSequence.slice(0, 30),
            domainToken,
            rawProb
          });
        }
        
        tf.dispose([textTensor, sourceTensor, fakeNewsData]);
      } catch (fakeNewsError) {
        console.log('CRITICAL ERROR with fake news model:', fakeNewsError);
        console.log('Error details:', fakeNewsError.message);
        console.log('Stack trace:', fakeNewsError.stack);
      }
      
      // Run clickbait model - we'll keep this simple since it's working
      try {
        // Process input for clickbait model
        clickbaitInput = await processClickbaitInput(text, 30);
        
        // Create tensor for the clickbait model
        const clickbaitTensor = tf.tensor2d([clickbaitInput.sequence], [1, clickbaitInput.sequence.length]);
        
        // Get prediction from clickbait model
        const clickbaitPrediction = this.models.clickbait.predict(clickbaitTensor);
        const clickbaitProbs = await clickbaitPrediction.data();
        
        // Create result object
        clickbaitResult = {
          label: clickbaitProbs[0] > 0.5 ? 'LABEL_1' : 'LABEL_0',
          score: clickbaitProbs[0] > 0.5 ? clickbaitProbs[0] : 1 - clickbaitProbs[0],
          rawProbability: clickbaitProbs[0]
        };
        
        if (this.debugLogs.clickbait.length < 10) {
          this.debugLogs.clickbait.push({
            textSample: text.slice(0, 60),
            tokensUsed: clickbaitInput.debug.tokenInfo.slice(0, 10),
            rawProbability: clickbaitProbs[0]
          });
        }
        
        // Clean up tensor
        clickbaitTensor.dispose();
        clickbaitPrediction.dispose();
      } catch (clickbaitError) {
        console.log('Error with clickbait model:', clickbaitError);
      }
      
      // At the end, before returning results, store analysis info
      // Store full analysis details for debugging
      const analysisDetails = {
        text: text,
        timestamp: new Date().toISOString(),
        fakeNewsTokens: fakeNewsInputs ? fakeNewsInputs.textSequence.slice(0, 20) : [],
        clickbaitTokens: clickbaitInput ? clickbaitInput.debug.tokenInfo.slice(0, 20).map(t => t) : [],
        domainToken: domainToken,
        predictions: {
          fakeNews: fakeNewsResult,
          clickbait: clickbaitResult
        }
      };
      
      // Only store the most recent 10 analyses
      this.recentAnalyses.unshift(analysisDetails);
      if (this.recentAnalyses.length > 10) {
        this.recentAnalyses.pop();
      }
      
      // After both models have been run and before return statement
      if (fakeNewsInputs) {

        // Try both potential locations of the word index mapping
        let wordIndex = 
          this.tokenizers.fakeNewsText.config.word_index || 
          {};
        
          if (typeof wordIndex === 'string') {
            try {
              wordIndex = JSON.parse(wordIndex);
            } catch (e) {
              console.error("Failed to parse wordIndex as JSON:", e);
            }
          }

        let tokenToWord = this.tokenizers.fakeNewsText.config.index_word;

        if (typeof tokenToWord === 'string') {
            try {
                tokenToWord = JSON.parse(tokenToWord);
            } catch (e) {
              console.error("Failed to parse wordIndex as JSON:", e);
            }
          }
      }

      // Return combined results
      return { 
        fakeNews: fakeNewsResult, 
        clickbait: clickbaitResult
      };
    } catch (error) {
      console.log('TOP-LEVEL Error in analyzeText:', error);
      console.log('Stack trace:', error.stack);
      // Return fallback results
      return {
        fakeNews: { label: 'LABEL_1', score: 0.5 },
        clickbait: { label: 'LABEL_1', score: 0.5 }
      };
    }
  },
  
  // New function to display recent analysis details
  showRecentAnalyses: function(count = 3) {
    const analyses = this.recentAnalyses.slice(0, count);
    console.group('Recent Text Analyses');
    
    if (analyses.length === 0) {
      console.log('No analyses available yet');
      console.groupEnd();
      return;
    }
    
    analyses.forEach((analysis, index) => {
      console.group(`Analysis #${index+1} - ${analysis.timestamp}`);
      
      console.log('Sentence:', analysis.text.substring(0, 100) + (analysis.text.length > 100 ? '...' : ''));
      
      console.group('Fake News Analysis');
      console.log('Prediction:', 
        `${analysis.predictions.fakeNews.label === 'LABEL_0' ? '⚠️ UNVERIFIED' : '✓ VERIFIED'} (${(analysis.predictions.fakeNews.score * 100).toFixed(1)}% confidence)`);
      console.log('First 10 tokens:', analysis.fakeNewsTokens.slice(0, 10));
      console.log('Domain token used:', analysis.domainToken);
      console.groupEnd();
      
      console.group('Clickbait Analysis');
      console.log('Prediction:', 
        `${analysis.predictions.clickbait.label === 'LABEL_0' ? '⚠️ CLICKBAIT' : '✓ NOT CLICKBAIT'} (${(analysis.predictions.clickbait.score * 100).toFixed(1)}% confidence)`);
      if (analysis.clickbaitTokens.length > 0) {
        console.table(analysis.clickbaitTokens.slice(0, 10));
      }
      console.groupEnd();
      
      console.groupEnd();
    });
    
    console.groupEnd();
  },
  
  // Extract base domain from URL for source input
  extractBaseDomain: function(url) {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      
      if (parts.length > 2) {
        // Check for country code TLDs like .co.uk
        if (parts[parts.length - 2] === 'co' || 
            parts[parts.length - 2] === 'com' || 
            parts[parts.length - 2] === 'net' || 
            parts[parts.length - 2] === 'org') {
          // Return domain without extension (e.g., 'bbc' from 'bbc.co.uk')
          if (parts.length > 3) {
            return parts[parts.length - 3];
          }
        }
        return parts[parts.length - 2];
      } else if (parts.length === 2) {
        return parts[0];
      }
      return hostname;
    } catch (e) {
      console.error("Error extracting domain:", e);
      return "";
    }
  },
  
  // Analyze an array of text strings using both models
  analyzeTextArray: async function(textArray) {
    try {
      // Initialize if needed
      if (!this.initialized || !this.models.fakeNews || !this.models.clickbait) {
        const success = await this.initialize();
        if (!success) {
          // Return fallback results if initialization fails
          return {
            predictions: textArray.map(() => ({
              fakeNews: { label: 'LABEL_0', score: 0.5 },
              clickbait: { label: 'LABEL_0', score: 0.5 }
            }))
          };
        }
      }
      
      // Process all texts with improved tokenization
      const predictions = await Promise.all(
        textArray.map(async (text) => await this.analyzeText(text))
      );
      
      // Log summary of predictions
      const fakeNewsPositives = predictions.filter(p => p.fakeNews.label === 'LABEL_1').length;
      const clickbaitPositives = predictions.filter(p => p.clickbait.label === 'LABEL_1').length;

      console.log(`Analysis of ${textArray.length} texts: ${fakeNewsPositives} fake news, ${clickbaitPositives} clickbait`);
      console.log('Full predictions:', predictions);
      
      return { predictions };
    } catch (error) {
      console.error('Error analyzing text array:', error);
      // Return fallback results
      return {
        predictions: textArray.map(() => ({
          fakeNews: { label: 'LABEL_0', score: 0.5 },
          clickbait: { label: 'LABEL_0', score: 0.5 }
        }))
      };
    }
  }
};

// Try to initialize right away if TensorFlow is already loaded
if (window.tf) {
  // Check sessionStorage first before initializing
  if (isTensorFlowInitialized()) {
    console.log('TensorFlow.js already initialized in this session, skipping initialization');
  } else {
    console.log('TensorFlow.js detected, initializing AI analyzer with WebGL backend');
    tf.ready().then(() => {
      // Try to use WebGL directly
      tf.setBackend('webgl').then(() => {
        console.log('WebGL backend set successfully');
        window.aiAnalyzer.initialize();
      }).catch(error => {
        console.error('Error setting WebGL backend:', error);
        // Continue with default backend
        window.aiAnalyzer.initialize();
      });
    }).catch(error => {
      console.error('Error during TensorFlow.js ready:', error);
    });
  }
} else {
  console.log('TensorFlow.js not detected, will initialize when loaded');
  // Add an event listener to detect when TF is loaded
  window.addEventListener('load', () => {
    if (window.tf) {
      console.log('TensorFlow.js detected after page load');
      window.aiAnalyzer.initialize();
    } else {
      console.warn('TensorFlow.js still not available after page load');
    }
  });
}
