const fs = require('fs');
const path = require('path');
const tf = require('@tensorflow/tfjs-node');

// Import custom components utility to register regularizers
const { registerCustomComponents } = require('./utils/customComponents');
// Import source encoder
const sourceEncoder = require('./utils/sourceEncoder');

// Sample news titles for testing - mix of likely real and fake news
const sampleTitles = [
  "Scientists discover vaccine that is 100% effective against all diseases",
  "Local community comes together to rebuild after storm damage",
  "Government announces new tax plan starting next month",
  "Sophia Bush Sends Sweet Birthday Message to 'One Tree Hill' Co-Star Hilarie Burton: 'Breyton 4eva'",
  "Is Brad Pitt Open To Getting Back Together With Angelina After Rumors She’s Into It?",
  "Sophia Bush Sends Sweet Birthday Message to 'One Tree Hill' Co-Star Hilarie Burton: 'Breyton 4eva'",
  "People's Choice Awards 2018: The best red carpet looks"
];

// Sample news sources for testing
const sampleSources = [
  "Reuters",
  "Associated Press",
  "CNN",
  "nyfoxnews",
  "etonline",
  "nyfoxnews",
  "today"
];

/**
 * Parse word counts into word_index mapping (for Keras tokenizers)
 */
function parseWordCounts(wordCountsStr) {
  try {
    // Handle nested JSON format: { "word_index": "{\"<OOV>\": 1, ...}" }
    if (typeof wordCountsStr === 'object' && wordCountsStr.word_index) {
      if (typeof wordCountsStr.word_index === 'string') {
        return JSON.parse(wordCountsStr.word_index);
      }
      return wordCountsStr.word_index;
    }
    
    // Check if this is the word_index format already as string
    if (typeof wordCountsStr === 'string') {
      if (wordCountsStr.startsWith('{"<OOV>":') || wordCountsStr.startsWith('{"word_index":')) {
        // If it's in the format {"word_index": "{"<OOV>": 1, ..."}"}
        try {
          const parsed = JSON.parse(wordCountsStr);
          if (parsed.word_index && typeof parsed.word_index === 'string') {
            // The word_index is a string-encoded JSON
            return JSON.parse(parsed.word_index);
          }
          return parsed.word_index || parsed;
        } catch (e) {
          // If parsing fails, try to clean the string further
          const cleanedStr = wordCountsStr.replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"');
          return JSON.parse(cleanedStr);
        }
      }
    }

    // Otherwise use the original approach for word_counts format
    const cleanedStr = wordCountsStr.replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"');
    const wordCounts = JSON.parse(cleanedStr);
    
    // Convert to word_index format (sorted by frequency)
    const wordFrequencies = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
    
    const wordIndex = {};
    let index = 1; // Start from 1, reserve 0 for padding
    
    // Add special tokens first if they exist
    if (wordCounts['<OOV>'] !== undefined) {
      wordIndex['<OOV>'] = index++;
    }
    if (wordCounts['<PAD>'] !== undefined) {
      wordIndex['<PAD>'] = 0; // Padding is typically 0
    }
    
    // Add all other words
    for (const [word, count] of wordFrequencies) {
      if (word !== '<OOV>' && word !== '<PAD>') {
        wordIndex[word] = index++;
      }
    }
    
    return wordIndex;
  } catch (error) {
    console.error("Error parsing word counts:", error);
    console.error("Input was:", wordCountsStr);
    return {};
  }
}

/**
 * Process text using the tokenizer
 * @param {string} text - Input text
 * @param {Object} tokenizer - The tokenizer configuration
 * @param {number} maxLen - Maximum sequence length
 * @param {number} vocabSize - Maximum vocabulary size (for clamping)
 * @returns {Object} - Tokenized and padded sequence with debug info
 */
function processText(text, tokenizer, maxLen = 300, vocabSize = 20000) {
  // Apply configuration from tokenizer
  let processedText = text;
  
  // Apply lowercase if configured
  const shouldLowercase = 
    (tokenizer.config && tokenizer.config.lowercase) || 
    (tokenizer.config && tokenizer.config.lower) ||
    tokenizer.lowercase;
    
  if (shouldLowercase) {
    processedText = processedText.toLowerCase();
  }
  
  // Apply filters if configured
  const filters = 
    (tokenizer.config && tokenizer.config.filters) || 
    tokenizer.filters;
    
  if (filters) {
    const filterRegex = new RegExp(`[${filters.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}]`, 'g');
    processedText = processedText.replace(filterRegex, ' ');
  }
  
  // Split text based on configured split character
  const splitChar = 
    (tokenizer.config && tokenizer.config.split) || 
    tokenizer.split || ' ';
    
  const charLevel = 
    (tokenizer.config && tokenizer.config.char_level) || 
    tokenizer.char_level;
    
  let tokens = [];
  
  if (charLevel) {
    tokens = processedText.split('');
  } else {
    tokens = processedText.split(splitChar).filter(t => t.length > 0);
  }
  
  // Convert tokens to IDs
  const wordIndex = tokenizer.word_index || {};
  const oovTokenId = 
    tokenizer.oov_token_id || 
    (tokenizer.config && tokenizer.config.oov_token ? wordIndex[tokenizer.config.oov_token] : 1);
  
  // Ensure oovTokenId is within valid range
  const safeOovId = Math.min(oovTokenId, vocabSize - 1);
  
  const sequence = [];
  const tokenDebug = [];
  
  tokens.forEach(token => {
    let id = wordIndex[token] || safeOovId;
    
    // IMPORTANT: Clamp IDs to be within the model's vocabulary range
    // This prevents the out-of-range error
    if (id >= vocabSize || id < 0) {
      console.warn(`Token "${token}" mapped to invalid ID ${id}, using OOV token ID ${safeOovId} instead`);
      id = safeOovId;
    }
    
    sequence.push(id);
    tokenDebug.push({ 
      token, 
      id, 
      isOOV: wordIndex[token] === undefined,
      clamped: (wordIndex[token] || safeOovId) !== id
    });
  });
  
  // Create debug info for original non-padded sequence
  const originalDebug = [...tokenDebug];
  
  // Pad or truncate sequence to maxLen
  if (sequence.length > maxLen) {
    return {
      sequence: sequence.slice(0, maxLen),
      tokenDebug: tokenDebug.slice(0, maxLen),
      originalDebug,
      truncated: true
    };
  }
  
  // Padding
  const padValue = tokenizer.pad_token_id || 0;
  while (sequence.length < maxLen) {
    sequence.push(padValue);
    tokenDebug.push({ token: '<PAD>', id: padValue, isPadding: true });
  }
  
  return {
    sequence,
    tokenDebug,
    originalDebug,
    truncated: false,
    padded: sequence.length > originalDebug.length
  };
}

/**
 * Validate token sequences against vocabulary size
 * @param {Array<number>} sequence - Token sequence
 * @param {number} vocabSize - Vocabulary size
 * @returns {Object} - Validation result
 */
function validateSequence(sequence, vocabSize) {
  const outOfRangeIndices = [];
  
  for (let i = 0; i < sequence.length; i++) {
    if (sequence[i] >= vocabSize || sequence[i] < 0) {
      outOfRangeIndices.push({
        position: i,
        value: sequence[i]
      });
    }
  }
  
  return {
    valid: outOfRangeIndices.length === 0,
    outOfRangeIndices,
    maxIndex: Math.max(...sequence),
    minIndex: Math.min(...sequence)
  };
}

/**
 * Map source name to ID using the source encoder
 * @param {string} source - Source name
 * @returns {Object} - Source ID with debug info
 */
function mapSourceToId(source) {
  // If source encoder is initialized, use it
  if (sourceEncoder.initialized) {
    const result = sourceEncoder.getSourceIndex(source);
    // Ensure index is valid (non-negative)
    if (result.index < 0) {
      console.warn(`Warning: Negative source index ${result.index} detected for "${source}", using fallback index 1`);
      result.index = 1;  // Use OOV index as fallback
    }
    return result;
  }
  
  // Fallback to simple hash if source encoder is not available
  const id = Math.abs(source.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 2030 + 1;
  return { 
    index: id, 
    type: 'hash', 
    found: false,
    sourceName: source,
    reason: "Source encoder not initialized"
  };
}

/**
 * Load the tokenizer from JSON file
 */
function loadTokenizer(tokenizerPath) {
  try {
    // First try the converted tokenizer
    const convertedPath = tokenizerPath.replace('.json', '_converted.json');
    if (fs.existsSync(convertedPath)) {
      console.log(`Using converted tokenizer from ${convertedPath}`);
      const tokenizerData = fs.readFileSync(convertedPath, 'utf8');
      const tokenizer = JSON.parse(tokenizerData);
      
      // Handle nested word_index
      if (tokenizer.word_index) {
        if (typeof tokenizer.word_index === 'string') {
          tokenizer.word_index = JSON.parse(tokenizer.word_index);
        }
      }
      
      return tokenizer;
    }
    
    // Fall back to original tokenizer
    console.log(`Loading original tokenizer from ${tokenizerPath}`);
    const tokenizerData = fs.readFileSync(tokenizerPath, 'utf8');
    const tokenizer = JSON.parse(tokenizerData);
    
    // Handle nested word_index
    if (tokenizer.word_index) {
      if (typeof tokenizer.word_index === 'string') {
        tokenizer.word_index = JSON.parse(tokenizer.word_index);
      }
    }
    
    return tokenizer;
  } catch (error) {
    console.error(`Error loading tokenizer from ${tokenizerPath}:`, error);
    return null;
  }
}

/**
 * Test the model with sample data
 */
async function testModel() {
  try {
    console.log("Starting model testing...");
    
    // Register custom components before loading models
    registerCustomComponents();
    
    // Path configurations
    const modelPath = 'file://./fake_news_model/model.json';
    const tokenizerPath = './fake_news_model/tokenizer.json';
    const sourceEncoderPath = './fake_news_model/source_encoder.json';
    
    // Try to load source encoder if not already initialized
    if (!sourceEncoder.initialized) {
      sourceEncoder.loadFromFile(sourceEncoderPath);
    }
    
    // Load tokenizer
    console.log("Loading tokenizer...");
    const tokenizer = loadTokenizer(tokenizerPath);
    
    if (!tokenizer) {
      console.error("Failed to load tokenizer. Using fallback tokenization.");
    } else {
      console.log("Tokenizer loaded successfully");
    }
    
    // Extract text tokenizer
    const textTokenizer = tokenizer?.text_tokenizer || tokenizer;
    
    // Load model
    console.log("Loading model...");
    const model = await tf.loadLayersModel(modelPath);
    console.log("Model loaded successfully");
    
    // Extract model vocabulary size
    const textEmbeddingLayer = model.layers.find(l => l.name === "text_embedding");
    const textVocabSize = textEmbeddingLayer ? textEmbeddingLayer.getConfig().inputDim : 20000;
    
    const sourceEmbeddingLayer = model.layers.find(l => l.name === "source_embedding");
    const sourceVocabSize = sourceEmbeddingLayer ? sourceEmbeddingLayer.getConfig().inputDim : 2031;
    
    console.log(`Model text vocabulary size: ${textVocabSize}`);
    console.log(`Model source vocabulary size: ${sourceVocabSize}`);
    
    // Display model info
    console.log("Model input shapes:", model.inputs.map(i => `${i.name}: [${i.shape}]`));
    console.log("Model output shape:", model.outputs[0].shape);
    
    // Test with individual examples
    console.log("\n=== INDIVIDUAL NEWS ARTICLES ===");
    for (let i = 0; i < sampleTitles.length; i++) {
      const title = sampleTitles[i];
      const source = sampleSources[i % sampleSources.length];
      
      await testSingleExample(model, title, source, textTokenizer);
    }
    
    // Test same news across different sources
    console.log("\n=== SOURCE INFLUENCE TEST ===");
    const testHeadline = "Breaking: Scientists discover breakthrough treatment";
    console.log(`Testing headline "${testHeadline}" across different sources:`);
    
    for (const source of sampleSources) {
      await testSingleExample(model, testHeadline, source, textTokenizer, true);
    }
    
  } catch (error) {
    console.error("Error during model testing:", error);
  }
}

/**
 * Test a single example
 */
async function testSingleExample(model, title, source, textTokenizer, compact = false) {
  try {
    // Extract model config
    const textVocabSize = 
      (model.layers && model.layers.find(l => l.name === "text_embedding")?.getConfig().inputDim) || 20000;
    
    const sourceVocabSize = 
      (model.layers && model.layers.find(l => l.name === "source_embedding")?.getConfig().inputDim) || 2031;
    
    // Process inputs with vocabulary size limits
    const textProcessed = processText(title, textTokenizer, 300, textVocabSize);
    const sourceProcessed = mapSourceToId(source);
    
    // Validate text sequence
    const validation = validateSequence(textProcessed.sequence, textVocabSize);
    if (!validation.valid) {
      console.warn(`Warning: ${validation.outOfRangeIndices.length} tokens are outside valid range [0,${textVocabSize-1}]`);
      console.warn(`Range in sequence: [${validation.minIndex},${validation.maxIndex}]`);
    }
    
    // Create tensors (safely)
    const textTensor = tf.tensor2d([textProcessed.sequence], [1, 300]);
    const sourceTensor = tf.tensor2d([[Math.min(sourceProcessed.index, sourceVocabSize-1)]], [1, 1]);
    
    // Make prediction
    const prediction = model.predict([textTensor, sourceTensor]);
    const score = prediction.dataSync()[0];
    
    // Display results
    if (compact) {
      console.log(`Source: ${source.padEnd(20)} | ID: ${sourceProcessed.index} | Score: ${score.toFixed(4)} | ${score >= 0.5 ? ' LIKELY REAL' : ' LIKELY Fake'}`);
    } else {
      console.log("\n--------------------------------------");
      console.log("Title:", title);
      console.log("Source:", source);
      
      // Print token information
      console.log("\nTOKENIZATION DETAILS:");
      console.log(`Original text tokens (${textProcessed.originalDebug.length}):`);
      const tokensPreview = textProcessed.originalDebug.map(t => `${t.token}(${t.id}${t.clamped ? '*' : ''})`).join(', ');
      console.log(tokensPreview.length > 100 ? tokensPreview.substring(0, 100) + '...' : tokensPreview);
      
      if (textProcessed.truncated) {
        console.log(`Note: Text was truncated from ${textProcessed.originalDebug.length} to 300 tokens`);
      }
      if (textProcessed.padded) {
        console.log(`Note: Text was padded with ${textProcessed.sequence.length - textProcessed.originalDebug.length} padding tokens`);
      }
      
      // Print source information
      console.log("\nSOURCE DETAILS:");
      const actualSourceId = Math.min(sourceProcessed.index, sourceVocabSize-1);
      console.log(`Source "${source}" mapped to ID: ${actualSourceId}${actualSourceId !== sourceProcessed.index ? ` (clamped from ${sourceProcessed.index})` : ''}`);
      
      if (!sourceProcessed.found) {
        if (sourceProcessed.type === 'hash') {
          console.log("Source ID was generated with hash function (not found in vocabulary)");
        } else {
          console.log("Source was not found in source encoder");
          
          if (sourceProcessed.suggestions && sourceProcessed.suggestions.length > 0) {
            console.log("Similar sources:");
            sourceProcessed.suggestions.forEach(s => {
              console.log(`- "${s}"`);
            });
          }
        }
      }
      
      console.log("\nMODEL PREDICTION:");
      console.log("Fake news probability:", score.toFixed(4));
      console.log("Assessment:", score >= 0.5 ? "LIKELY REAL" : "LIKELY FAKE");
      console.log("--------------------------------------");
    }
    
    // Clean up tensors
    tf.dispose([textTensor, sourceTensor, prediction]);
    
  } catch (error) {
    console.error(`Error testing example "${title}" from "${source}":`, error);
  }
}

// Run the test
testModel().then(() => {
  console.log("\nModel testing completed");
}).catch(err => {
  console.error("Error during testing:", err);
}).finally(() => {
  // Clean up TF resources
  setTimeout(() => process.exit(), 1000);
});
