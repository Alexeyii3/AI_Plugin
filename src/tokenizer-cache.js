/**
 * Tokenizer Cache
 * Handles caching of tokenizer configuration data using sessionStorage
 */

const TOKENIZER_KEYS = {
  FAKE_NEWS_TEXT: 'tokenizer_fake_news_text',
  FAKE_NEWS_SOURCE: 'tokenizer_fake_news_source',
  CLICKBAIT: 'tokenizer_clickbait'
};

// Save a tokenizer's configuration to sessionStorage
export function saveTokenizer(key, tokenizerData) {
  try {
    const serialized = JSON.stringify(tokenizerData);
    sessionStorage.setItem(key, serialized);
    console.log(`Saved tokenizer cache: ${key}`);
    return true;
  } catch (e) {
    console.error(`Error saving tokenizer cache for ${key}: ${e.message}`);
    return false;
  }
}

// Retrieve tokenizer configuration from sessionStorage
export function getTokenizer(key) {
  try {
    const serialized = sessionStorage.getItem(key);
    if (!serialized) return null;
    const data = JSON.parse(serialized);
    console.log(`Retrieved tokenizer from cache: ${key}`);
    return data;
  } catch (e) {
    console.error(`Error retrieving tokenizer cache for ${key}: ${e.message}`);
    return null;
  }
}

// Check if all tokenizers are cached
export function areTokenizersCached() {
  return Object.values(TOKENIZER_KEYS).every(key => !!sessionStorage.getItem(key));
}

// Save all tokenizers at once
export function saveAllTokenizers(tokenizers) {
  saveTokenizer(TOKENIZER_KEYS.FAKE_NEWS_TEXT, {
    config: tokenizers.fakeNewsText.config
  });
  saveTokenizer(TOKENIZER_KEYS.FAKE_NEWS_SOURCE, {
    config: tokenizers.fakeNewsSource.config
  });
  saveTokenizer(TOKENIZER_KEYS.CLICKBAIT, {
    config: tokenizers.clickbait.config,
    word_index: tokenizers.clickbait.word_index
  });
  return true;
}

// Restore tokenizers from cache. Here you may need to adjust
// the restoration to match what loadTokenizer normally returns.
export function restoreTokenizers() {
  const fakeNewsText = getTokenizer(TOKENIZER_KEYS.FAKE_NEWS_TEXT);
  const fakeNewsSource = getTokenizer(TOKENIZER_KEYS.FAKE_NEWS_SOURCE);
  const clickbait = getTokenizer(TOKENIZER_KEYS.CLICKBAIT);
  const tokenizers = {};
  if (fakeNewsText) tokenizers.fakeNewsText = fakeNewsText;
  if (fakeNewsSource) tokenizers.fakeNewsSource = fakeNewsSource;
  if (clickbait) tokenizers.clickbait = clickbait;
  console.log('Restored tokenizers:', Object.keys(tokenizers));
  return tokenizers;
}
