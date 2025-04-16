/**
 * Tokenization utilities for AI text analysis models
 */

// Import necessary TensorFlow.js libraries if needed

/**
 * Load and parse tokenizer for fake news model
 */
export async function loadTokenizer(path) {
  try {
    const response = await fetch(chrome.runtime.getURL(`models/${path}`));
    if (!response.ok) {
      throw new Error(`Failed to load tokenizer: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading tokenizer:', error);
    // Return a minimal fallback tokenizer
    return {
      word_index: { '<UNK>': 1 },
      config: { oov_token: '<UNK>' }
    };
  }
}

/**
 * Load and parse source encoder for fake news model
 */
export async function loadSourceEncoder(path) {
  try {
    const response = await fetch(chrome.runtime.getURL(`models/${path}`));
    if (!response.ok) {
      throw new Error(`Failed to load source encoder: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading source encoder:', error);
    // Return a minimal fallback source encoder
    return {
      index: { '<UNK>': 0 }
    };
  }
}

/**
 * Process input for fake news detection model
 * Remove the export keyword here since we're exporting at the bottom
 */
async function processFakeNewsInput(text, source, maxTextLength = 300, maxSourceLength = 1) {
  try {
    // Get tokenizers from window.aiAnalyzer
    const textTokenizer = window.aiAnalyzer.tokenizers.fakeNewsText;
    const sourceEncoder = window.aiAnalyzer.tokenizers.fakeNewsSource;
    

  
    // Find the word_docs field which contains the mappings in your tokenizer
    let wordIndex = 
      textTokenizer?.config?.word_index || // Then try word_index
      {}; // Fallback to empty object
    //need to make javascript object the wordIndex to see the mappings

    // If wordIndex is a string (which might happen if it's a stringified JSON), try to parse it
    if (typeof wordIndex === 'string') {
      try {
        wordIndex = JSON.parse(wordIndex);

      } catch (e) {
        console.error("Failed to parse wordIndex as JSON:", e);
      }
    }
    
    if (Object.keys(wordIndex).length === 0) {
      throw new Error('Text tokenizer vocabulary is empty');
    }
    
    if (!sourceEncoder || !sourceEncoder.source_to_index) {
      throw new Error('Source encoder not properly loaded');
    }
    
    // Preprocess the text
    const preprocessedText = text.toLowerCase().trim()
      .replace(/[^\w\s]/g, ' ')  // Replace punctuation with space
      .replace(/\s+/g, ' ');     // Normalize whitespace
    
    // Tokenize text
    const words = preprocessedText.split(' ');
    const oovToken = 1; // OOV token is typically 1 in the tokenizer
    
    // Convert words to token IDs using the correct word index mapping
    const textSequence = words.map(word => {
      return wordIndex[word] || oovToken;
    });
    
    // Truncate or pad text sequence
    const paddedTextSequence = textSequence.slice(0, maxTextLength);
    while (paddedTextSequence.length < maxTextLength) {
      paddedTextSequence.push(0); // Pad with zeros
    }
    
    // Process source
    let sourceIndex = 0; // Default
    if (source && sourceEncoder.source_to_index[source]) {
      sourceIndex = sourceEncoder.source_to_index[source];
    }
    const sourceSequence = [sourceIndex]; // Just one value for the source
    
    return {
      textSequence: paddedTextSequence,
      sourceSequence: sourceSequence,
      debug: {
        originalText: text,
        preprocessedText,
        sourceText: source,
        sourceIndex,
        wordIndexUsed: textTokenizer?.config?.word_docs ? 'word_docs' : 
                       textTokenizer?.config?.word_index ? 'word_index' : 'unknown'
      }
    };
  } catch (error) {
    console.error('Error processing fake news input:', error);
    console.error('Stack trace:', error.stack);
    // Return a fallback sequence
    return {
      textSequence: Array(maxTextLength).fill(0),
      sourceSequence: [0],
      debug: { error: error.message }
    };
  }
}

// Process text for the clickbait model (only text input)
async function processClickbaitInput(text, maxLen = 30) {
  try {
    // Fetch clickbait tokenizer
    const tokenizer = await loadClickbaitTokenizer('tfjs_clickbait_model/word_index.json', 'tfjs_clickbait_model/tokenizer_config.json');
    
    // Process the text with the clickbait tokenizer
    const textSequence = processClickbaitText(text, tokenizer, maxLen);
    
    return {
      sequence: textSequence.sequence,
      debug: textSequence
    };
  } catch (error) {
    console.error('Error processing clickbait input:', error);
    // Return fallback sequence
    return {
      sequence: new Array(maxLen).fill(0),
      error: error.message
    };
  }
}

// General text processing function for fake news model
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
    
    // Clamp IDs to be within the model's vocabulary range
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

// Process source domain for the fake news model
function processSource(source, sourceEncoder, maxLen = 30) {
  // Lowercase and trim the source domain
  const processedSource = (source || "").toLowerCase().trim();
  
  // Get the source ID from the encoder
  const sourceIndex = sourceEncoder?.index || {};
  const oovId = sourceIndex['<UNK>'] || 0;
  
  // Generate sequence (just a single token for the source)
  const id = sourceIndex[processedSource] || oovId;
  const sequence = [id];
  
  // Pad to maxLen
  while (sequence.length < maxLen) {
    sequence.push(0); // Pad with zeros
  }
  
  return {
    sequence,
    sourceId: id,
    originalSource: source,
    processedSource,
    isOOV: !sourceIndex[processedSource]
  };
}

// Process text specifically for the clickbait model
function processClickbaitText(text, tokenizer, maxLen = 30) {
  // Simple preprocessing - lowercase
  const processedText = text.toLowerCase();
  
  // Split into words
  const words = processedText.split(/\s+/).filter(w => w.length > 0);
  
  // Convert to IDs
  let wordIndex = tokenizer.word_index || {};
  console.log("clickbaits Word index length:", Object.keys(wordIndex).length);
  if (typeof wordIndex === 'string') {
    try {
      wordIndex = JSON.parse(wordIndex);
      console.log("Parsed wordIndex from string. New length:", Object.keys(wordIndex).length);
    } catch (e) {
      console.error("Failed to parse wordIndex as JSON:", e);
    }
  }
  const oovToken = tokenizer.oov_token || '<UNK>';
  const oovId = wordIndex[oovToken] || 1;
  
  const sequence = [];
  const tokenInfo = [];
  
  for (const word of words) {
    const id = wordIndex[word] || oovId;
    sequence.push(id);
    tokenInfo.push({
      token: word,
      id,
      isOOV: wordIndex[word] === undefined
    });
  }

  
  // Truncate or pad as needed
  if (sequence.length > maxLen) {
    return {
      sequence: sequence.slice(0, maxLen),
      tokenInfo: tokenInfo.slice(0, maxLen),
      truncated: true
    };
  }
  
  // Padding
  while (sequence.length < maxLen) {
    sequence.push(0); // Padding token
    tokenInfo.push({
      token: '<PAD>',
      id: 0,
      isPadding: true
    });
  }
  
  return {
    sequence,
    tokenInfo,
    truncated: false,
    padded: true
  };
}

// Load the tokenizer for the clickbait model
async function loadClickbaitTokenizer(wordIndexPath, configPath) {
  try {
    // Load word index
    const wordIndexResponse = await fetch(chrome.runtime.getURL(`models/${wordIndexPath}`));
    if (!wordIndexResponse.ok) {
      throw new Error(`Failed to load word index: ${wordIndexResponse.status}`);
    }
    const wordIndex = await wordIndexResponse.json();
    
    // Try to load config if available
    let config = { oov_token: '<UNK>', max_len: 30 };
    try {
      const configResponse = await fetch(chrome.runtime.getURL(`models/${configPath}`));
      if (configResponse.ok) {
        config = await configResponse.json();
      }
    } catch (e) {
      console.warn('Could not load tokenizer config, using defaults');
    }
    
    return {
      word_index: wordIndex,
      oov_token: config.oov_token || '<UNK>',
      max_len: config.max_len || 30,
      vocab_size: config.vocab_size || Object.keys(wordIndex).length + 1
    };
  } catch (error) {
    console.error('Error loading clickbait tokenizer:', error);
    // Return a minimal fallback tokenizer
    return {
      word_index: { '<UNK>': 1 },
      oov_token: '<UNK>',
      max_len: 30,
      vocab_size: 100
    };
  }
}

// Export all functions at the bottom
export {
  processFakeNewsInput,
  processClickbaitInput,
  processText,
  processSource,
  // loadTokenizer,         // Already exported with the function declaration
  // loadSourceEncoder,     // Already exported with the function declaration
  loadClickbaitTokenizer
};
