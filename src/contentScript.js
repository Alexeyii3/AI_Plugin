// contentScript.js

// Variable to track if highlighting is enabled
let highlightingEnabled = true;

// Variable to track if analysis is enabled
let analysisEnabled = true;

// Variables to track statistics
let totalAnalyzed = 0;
let highlightCount = 0;
let clickbaitOnlyCount = 0;
let fakeNewsCount = 0;
let bothCount = 0;

// Variable to track current site status
let currentSiteIsNews = false;

// Add a variable to track whether analysis was ever performed
let analysisWasPerformed = false;
// Add variables to keep the last known counts even when highlights are removed
let lastKnownCounts = {
    totalAnalyzed: 0,
    highlightCount: 0,
    fakeNewsCount: 0,
    clickbaitOnlyCount: 0,
    bothCount: 0
};

// Add these variables to track analysis status
let analysisInProgress = false;
let initialSiteCheck = false;

// Add this at the top with the other variables
let pageProcessedFlag = false;

// Define label mappings
const LABELS = {
    'LABEL_0': 'unverified',
    'LABEL_1': 'verified'
};

// Wait for TensorFlow and AI Analyzer to be properly initialized
async function ensureAiAnalyzerInitialized() {
    return new Promise((resolve) => {
        function checkAnalyzer() {
            if (window.aiAnalyzer) {
                console.log('AI Analyzer found, continuing...');
                resolve(true);
            } else {
                console.log('Waiting for AI Analyzer to be available...');
                setTimeout(checkAnalyzer, 200);
            }
        }
        checkAnalyzer();
    });
}

// Initialize AI analyzer when the script loads, but respect user settings
console.log('Content script loaded, checking analysis settings...');

// Check user settings before initializing analysis
chrome.storage.local.get(['analysisEnabled'], (result) => {
    // Default to true if not set
    analysisEnabled = result.analysisEnabled !== false;
    
    if (analysisEnabled) {
        console.log('Analysis is enabled, initializing...');
        initializeAnalysis();
    } else {
        console.log('Analysis is disabled by user settings');
    }
});

// Ensure AI analyzer is available and fully initialized
async function initializeAnalysis() {
    try {
        // Wait for aiAnalyzer object to be available
        await ensureAiAnalyzerInitialized();
        
        console.log('Starting full AI analyzer initialization...');
        console.log('aiAnalyzer object:', Object.keys(window.aiAnalyzer));
        
        let isReady = false;
        
        // Check if isReady function exists
        if (typeof window.aiAnalyzer.isReady === 'function') {
            console.log('Using isReady function');
            isReady = await window.aiAnalyzer.isReady();
        } else {
            // Fallback for older versions
            console.log('isReady function not found, using direct initialization');
            isReady = await window.aiAnalyzer.initialize();
        }
        
        if (!isReady) {
            console.error('AI analyzer initialization failed');
            return;
        }
        
        console.log('AI analyzer fully ready - processing page now');
        console.log('AI analyzer is ready, triggering a test analysis...');
        const testResult = await window.aiAnalyzer.analyzeText(
          'WATCH: Trump Supporter HAMMERS Trump For Committing Treason By Defending Russia'
        );
        console.log('Test analysis result:', testResult);
        processPage();
    } catch (err) {
        console.error('Error during AI analyzer initialization:', err);
        // Try direct initialization as a fallback
        try {
            const initSuccess = await window.aiAnalyzer.initialize();
            if (initSuccess) {
                processPage();
            }
        } catch (fallbackError) {
            console.error('Fallback initialization also failed:', fallbackError);
        }
    }
}

// Start the initialization process
initializeAnalysis();

/**
 * Extracts the base domain from a URL
 * @param {string} url - The URL to extract from
 * @returns {string} - The extracted base domain
 */
function extractBaseDomain(url) {
    try {
        // Extract hostname from URL
        const hostname = new URL(url).hostname;
        
        // Split the hostname by dots
        const parts = hostname.split('.');
        
        // For domains like co.uk, com.au, we want the part before these
        if (parts.length > 2) {
            // Check common patterns like .co.uk, .com.au, etc.
            if (parts[parts.length - 2] === 'co' || 
                parts[parts.length - 2] === 'com' || 
                parts[parts.length - 2] === 'net' || 
                parts[parts.length - 2] === 'org') {
                // If it's a domain like example.co.uk, return "example"
                if (parts.length > 3) {
                    return parts[parts.length - 3];
                }
            }
            // Return the subdomain part
            return parts[parts.length - 2];
        } else if (parts.length === 2) {
            // For domains like example.com, return "example"
            return parts[0];
        }
        return hostname; // Fallback to full hostname
    } catch (e) {
        console.error("Error extracting domain:", e);
        return "";
    }
}

/**
 * Checks if the current site is a news site.
 * @param {function} callback - Callback function to handle the response.
 * @param {boolean} forceCheck - Whether to force check even if we have a cached value.
 */
function isNewsSite(callback, forceCheck = false) {
    // If we've already done the initial site check and aren't forcing a new check, use the cached value
    if (initialSiteCheck && !forceCheck) {
        callback(currentSiteIsNews);
        return;
    }
    
    const currentUrl = window.location.href;
    const baseDomain = extractBaseDomain(currentUrl);
    console.log('Base domain for news site check:', baseDomain);
    
    // Set a safety timeout to ensure we always get a response
    let statusPending = true;
    const timeoutId = setTimeout(() => {
        if (statusPending) {
            console.log('Site status check timed out, using default');
            statusPending = false;
            initialSiteCheck = true;
            callback(currentSiteIsNews);
        }
    }, 5000);

    // First check if this is a user-added custom news site
    chrome.storage.sync.get(['customNewsSites'], (result) => {
        const customSites = result.customNewsSites || [];
        console.log('Found custom sites:', customSites);
        
        // Check if our base domain is in the custom sites list
        if (customSites.includes(baseDomain)) {
            console.log(`Found ${baseDomain} in custom news sites!`);
            clearTimeout(timeoutId);
            statusPending = false;
            currentSiteIsNews = true;
            initialSiteCheck = true;
            callback(true);
            return;
        }
        
        // If not in custom sites, check with the background script
        console.log('Not found in custom sites, checking with background script');
        chrome.runtime.sendMessage(
            { action: 'checkNewsSite', domain: baseDomain },
            (response) => {
                clearTimeout(timeoutId);
                statusPending = false;
                
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                    callback(false);
                    return;
                }
                
                console.log('Background response:', response);
                const isNewsSite = response && response.isNewsSite;
                currentSiteIsNews = isNewsSite;
                initialSiteCheck = true;
                callback(isNewsSite);
            }
        );
    });
}

// Main function to process the page
function processPage() {
    // Check if analysis is enabled first
    if (!analysisEnabled) {
        console.log('Analysis is disabled by user settings');
        return;
    }

    if (!highlightingEnabled) {
        return;
    }

    // Only process the page if it's a news site
    isNewsSite((isNews) => {
        currentSiteIsNews = isNews;
        
        if (isNews) {
            console.log('Site is a news site, processing content.');
            processPageContent();
        } else {
            console.log('Site is not a news site, skipping analysis.');
            // Reset statistics since we're not analyzing
            totalAnalyzed = 0;
            highlightCount = 0;
            fakeNewsCount = 0;
            clickbaitOnlyCount = 0;
            bothCount = 0;
            
            // Remove any existing highlights if present
            removeHighlights();
        }
    });
}

// Function to remove highlights - enhanced to clean up event listeners
function removeHighlights(resetStats = true) {
    const highlightedElements = document.querySelectorAll('.ai-plugin-highlight');
    highlightedElements.forEach((element) => {
        // Remove all highlight styles
        element.style.background = '';
        element.style.borderLeft = '';
        element.style.borderRadius = '';
        element.style.padding = '';
        element.style.boxShadow = '';
        element.style.transition = '';
        element.style.cursor = '';
        element.title = '';
        
        // Remove the highlight class
        element.classList.remove('ai-plugin-highlight');
        
        // Remove click event listeners
        element.onclick = null;
        
        // Clone and replace to ensure all event listeners are gone
        const newElement = element.cloneNode(true);
        if (element.parentNode) {
            element.parentNode.replaceChild(newElement, element);
        }
    });
    
    // Only reset statistics if requested
    if (resetStats) {
        highlightCount = 0;
        clickbaitOnlyCount = 0;
        fakeNewsCount = 0;
        bothCount = 0;
        // Don't reset totalAnalyzed to preserve knowledge that analysis was done
    }
}

// Track element status to handle combined fake news & clickbait highlighting
const elementStatus = new WeakMap();

// Function to highlight elements with different colors based on content type
function highlightElement(element, analysisType, label, score) {
    const threshold = 0.5; // Adjust based on your confidence requirements
    const clickbaitThreshold = 0.7; // Adjust based on your confidence requirements
    
    console.log('highlightElement', element, analysisType, label, score);
    
    let shouldHighlight = false;
    let tooltipText = '';
    
    // For fake news, highlight when it's LABEL_0 (unverified)
    // For clickbait, highlight when it's LABEL_1 (clickbait)
    if ((analysisType === 'fakeNews' && label === 'LABEL_0' && score >= threshold) ||
        (analysisType === 'clickbait' && label === 'LABEL_1' && score >= clickbaitThreshold)) {
        
        shouldHighlight = true;
        
        // Store the element's current status
        if (!elementStatus.has(element)) {
            elementStatus.set(element, { isFakeNews: false, isClickbait: false });
        }
        
        const status = elementStatus.get(element);
        
        // Update the status based on this analysis
        if (analysisType === 'fakeNews') {
            status.isFakeNews = true;
        } else if (analysisType === 'clickbait') {
            status.isClickbait = true;
        }
        
        // Build the tooltip based on current status
        if (status.isFakeNews && status.isClickbait) {
            tooltipText = `This may contain both unverified claims AND clickbait (${(score * 100).toFixed(1)}% confidence)`;
        } else if (status.isFakeNews) {
            tooltipText = `Potential unverified claim detected (${(score * 100).toFixed(1)}% confidence)`;
        } else if (status.isClickbait) {
            tooltipText = `Potential clickbait detected (${(score * 100).toFixed(1)}% confidence)`;
        }
        
        // Apply the highlight with the appropriate color
        if (shouldHighlight) {
            // Apply a clear, visible highlight style
            element.classList.add('ai-plugin-highlight');
            
            // Apply different colors based on the content type
            if (status.isFakeNews) {
                // Red for fake news (with or without clickbait)
                element.style.background = 'rgba(255, 200, 200, 0.4)';
                element.style.borderLeft = '3px solid #d9534f';
            } else if (status.isClickbait) {
                // Orange for clickbait only
                element.style.background = 'rgba(255, 220, 180, 0.4)';
                element.style.borderLeft = '3px solid #f0ad4e';
            }
            
            // Common styling
            element.style.borderRadius = '2px';
            element.style.padding = '2px 5px';
            element.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            element.style.cursor = 'pointer';
            
            // Add tooltip
            element.setAttribute('title', tooltipText);
            
            // Add click handler to show more info
            element.addEventListener('click', () => {
                let messageType = "";
                if (status.isFakeNews && status.isClickbait) {
                    messageType = "both unverified claims AND clickbait";
                } else if (status.isFakeNews) {
                    messageType = "unverified claims";
                } else if (status.isClickbait) {
                    messageType = "clickbait";
                }
                
                alert(`This content may contain ${messageType}.\n\nConfidence score: ${(score * 100).toFixed(1)}%\n\nWe recommend checking additional sources.`);
            });
            
            // Update statistics only when we first highlight the element or change its status
            if (!element.classList.contains('counted-highlight')) {
                element.classList.add('counted-highlight');
                highlightCount++;
                
                // Update type-specific counters
                if (status.isFakeNews && status.isClickbait) {
                    bothCount++;
                } else if (status.isFakeNews) {
                    fakeNewsCount++;
                } else if (status.isClickbait) {
                    clickbaitOnlyCount++;
                }
            }
        }
    }
    
    // Increment analyzed count regardless of highlighting
    totalAnalyzed++;
}

// Example logic to increment counts (wherever you detect fake news or clickbait):
function incrementCategoryCounts(isFakeNews, isClickbait) {
    if (isFakeNews && isClickbait) {
        bothCount++;
    } else if (isFakeNews) {
        fakeNewsCount++;
    } else if (isClickbait) {
        clickbaitOnlyCount++;
    }
    highlightCount++;
    totalAnalyzed++;
}

// Function to detect unverified claims
function isTextOnly(element) {
    for (let node of element.childNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
            // If there's an element node inside, it's not text-only
            return false;
        }
    }
    // If all child nodes are text nodes, or there are no element nodes
    return true;
}

// Main function to process the page content
async function processPageContent() {
    // MODIFY: Change window.pageProcessed to pageProcessedFlag so we can reset it
    if (pageProcessedFlag) {
        console.log('Page already processed, skipping duplicate processing');
        return;
    }
    
    try {
        // Set analysis in progress flag before starting
        analysisInProgress = true;
        
        // First check if analyzer is ready, with fallback
        let isReady = false;
        
        if (typeof window.aiAnalyzer.isReady === 'function') {
            isReady = await window.aiAnalyzer.isReady();
        } else {
            isReady = window.aiAnalyzer.initialized || await window.aiAnalyzer.initialize();
        }
        
        if (!isReady) {
            console.error('Cannot process page: AI analyzer not ready');
            return;
        }
        
        // Set the processed flag
        pageProcessedFlag = true;
        
        // Reset statistics before processing
        totalAnalyzed = 0;
        highlightCount = 0;
        
        chrome.storage.local.get(['highlightingEnabled'], async (result) => {
            const highlightingEnabled = result.highlightingEnabled !== false; // Default to true
            if (!highlightingEnabled) return;

            // Use arrays to maintain order even when texts repeat
            const textArray = [];
            const elementArray = [];
            
            // Select all relevant elements
            const elements = document.querySelectorAll('p, a, div, span, h1, h2, h3, h4, section, article');
            for (let element of elements) {
                if (!isTextOnly(element)) continue;
                const text = element.innerText.trim();
                if (text.length < 30) continue;
                textArray.push(text);
                elementArray.push(element);
            }
            
            if (textArray.length === 0) return;
            console.log(`Analyzing ${textArray.length} text elements...`);
            
            try {
                // Initialize AI analyzer if needed
                if (!window.aiAnalyzer || !window.aiAnalyzer.initialized) {
                    console.log('AI Analyzer needs initialization');
                    await window.aiAnalyzer.initialize();
                }
                
                // Verify that AI analyzer is fully initialized with tokenizers
                if (!window.aiAnalyzer.initialized || 
                    !window.aiAnalyzer.tokenizers || 
                    !window.aiAnalyzer.tokenizers.fakeNewsText) {
                    console.log('AI Analyzer needs full initialization');
                    await window.aiAnalyzer.initialize();
                }
                
                const analysisResults = await window.aiAnalyzer.analyzeTextArray(textArray);
                console.log('Analysis results:', analysisResults);
                
                // Process predictions using elementArray for one-to-one correspondence
                if (analysisResults && analysisResults.predictions && analysisResults.predictions.length > 0) {
                    console.log(`====== ANALYSIS SUMMARY ======`);
                    console.log(`Total texts analyzed: ${analysisResults.predictions.length}`);
                    
                    // Detect the prediction format and process accordingly
                    const samplePrediction = analysisResults.predictions[0];
                    console.log('Sample prediction:', samplePrediction);
                    const isNewFormat = (samplePrediction && 
                                         samplePrediction.modelUsed !== undefined && 
                                         !samplePrediction.fakeNews && 
                                         !samplePrediction.clickbait);
                    
                    console.log(`Using ${isNewFormat ? 'new' : 'legacy'} prediction format`);
                    
                    // Count flagged items based on the format
                    let fakeNewsFlags = 0;
                    let clickbaitFlags = 0;
                    
                    if (isNewFormat) {
                        fakeNewsFlags = analysisResults.predictions.filter(p => 
                          p?.label === 'LABEL_0' && p?.modelUsed === 'fakeNews'
                        ).length;
                        clickbaitFlags = analysisResults.predictions.filter(p => 
                          p?.label === 'LABEL_1' && p?.modelUsed === 'clickbait'
                        ).length;
                    } else {
                        fakeNewsFlags = analysisResults.predictions.filter(p => 
                          p?.fakeNews?.label === 'LABEL_0'
                        ).length;
                        clickbaitFlags = analysisResults.predictions.filter(p => 
                          p?.clickbait?.label === 'LABEL_1' 
                        ).length;
                    }
                    
                    console.log(`Flagged as Fake News: ${fakeNewsFlags}`);
                    console.log(`Flagged as Clickbait: ${clickbaitFlags}`);
                    console.log(`============================`);
                    
                    // Process each prediction - Let's make this section more robust
                    analysisResults.predictions.forEach((result, index) => {
                        // Handle both old and new prediction formats, plus the direct combined result format
                        let fakeNews, clickbait;
                        
                        // Check if this is a raw combined result rather than separate models
                        if (result.label && result.score && !result.modelUsed && !result.fakeNews && !result.clickbait) {
                            console.log(`Using single model result for element ${index}`, result);
                            // Single model result - assign to both for UI consistency
                            fakeNews = result;
                            clickbait = { label: 'LABEL_1', score: 0 }; // No clickbait result
                        }
                        // Check for the combined result but with fakeNews and clickbait structure
                        else if (result.fakeNews || result.clickbait) {
                            console.log(`Using dual model result for element ${index}`);
                            // Standard format with both models
                            fakeNews = result.fakeNews || { label: 'LABEL_1', score: 0 };
                            clickbait = result.clickbait || { label: 'LABEL_1', score: 0 };
                        }
                        // New format with modelUsed property
                        else if (result.modelUsed) {
                            console.log(`Using modelUsed format for element ${index}`, result);
                            if (result.modelUsed === 'fakeNews') {
                                fakeNews = { label: result.label, score: result.score };
                                clickbait = { label: 'LABEL_1', score: 0 };
                            } else {
                                fakeNews = { label: 'LABEL_1', score: 0 };
                                clickbait = { label: result.label, score: result.score };
                            }
                        }
                        // Fallback - treat as unknown format
                        else {
                            console.warn(`Unknown result format for element ${index}`, result);
                            fakeNews = { label: 'LABEL_1', score: 0 };
                            clickbait = { label: 'LABEL_1', score: 0 };
                        }
                        
                        const correspondingElement = elementArray[index];
                        if (correspondingElement) {
                          const threshold = 0.5;
                          const clickbaitThreshold = 0.7;
                          const elementText = textArray[index].substring(0, 60) + '...';
                          
                          // Highlight if it's fake news (LABEL_0) OR clickbait (LABEL_1)
                          if (fakeNews && fakeNews.label === 'LABEL_0' && fakeNews.score >= threshold) {
                            console.log(`=== FLAGGED AS FAKE NEWS ===`);
                            console.log(`Text: "${elementText}"`);
                            console.log(`Fake News: YES (${(fakeNews.score * 100).toFixed(1)}%)`);
                            
                            highlightElement(correspondingElement, 'fakeNews', 'LABEL_0', fakeNews.score);
                          }
                          
                          if (clickbait && clickbait.label === 'LABEL_1' && clickbait.score >= clickbaitThreshold) {
                            console.log(`=== FLAGGED AS CLICKBAIT ===`);
                            console.log(`Text: "${elementText}"`);
                            console.log(`Clickbait: YES (${(clickbait.score * 100).toFixed(1)}%)`);
                            
                            highlightElement(correspondingElement, 'clickbait', 'LABEL_1', clickbait.score);
                          }
                          
                          if ((fakeNews.label !== 'LABEL_0' || fakeNews.score < threshold) && 
                              (clickbait.label !== 'LABEL_1' || clickbait.score < clickbaitThreshold)) {
                            console.log(`Text (not flagged): "${elementText}"`);
                            console.log(`Fake News: ${fakeNews.rawProbability}%, Clickbait: ${clickbait.rawProbability}%`);
                            // Always increment analyzed count
                            totalAnalyzed++;
                          }
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to analyze text:', error);
                // Provide a fallback mechanism right here
                console.log('Using emergency fallback analysis');
                
                // Create simple fallback results
                const fallbackResults = {
                    predictions: textArray.map(() => ({
                        label: 'LABEL_0',
                        score: 0.85
                    }))
                };
                
                // Process with fallback results
                fallbackResults.predictions.forEach((result, index) => {
                    const { label, score } = result;
                    const correspondingElement = elementArray[index];
                    if (correspondingElement) {
                        // For fallback, assume it's fake news analysis
                        highlightElement(correspondingElement, 'fakeNews', label, score);
                    }
                });
            }
        });
        
        // After analysis completes successfully
        analysisWasPerformed = true;
        analysisInProgress = false;
        
        // If analysis is disabled, save the counts for later
        if (!analysisEnabled) {
            lastKnownCounts = {
                totalAnalyzed,
                highlightCount,
                fakeNewsCount,
                clickbaitOnlyCount,
                bothCount
            };
        }
    } catch (error) {
        // Mark analysis as complete even in case of error
        analysisInProgress = false;
        // ...existing error handling...
    }
}

// Listen for messages from the popup (for toggling highlighting)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle the highlighting toggle as a standalone message
    if (request.highlightingEnabled !== undefined && request.analysisEnabled === undefined) {
        console.log(`Highlighting ${request.highlightingEnabled ? 'enabled' : 'disabled'}`);
        highlightingEnabled = request.highlightingEnabled;
        
        // If highlighting was turned off, immediately remove highlights
        if (!highlightingEnabled) {
            console.log('Removing highlights due to toggle change');
            removeHighlights(false); // Keep the stats
        } else if (analysisEnabled) {
            // If highlighting was turned on and analysis is enabled, process page
            console.log('Highlighting enabled, processing page');
            processPage();
        }
    }
    
    // Handle analysis toggle message
    if (request.analysisEnabled !== undefined) {
        analysisEnabled = request.analysisEnabled;
        console.log(`Analysis ${analysisEnabled ? 'enabled' : 'disabled'}`);
        
        // If analysis was enabled and wasn't previously, initialize
        if (analysisEnabled && !window.aiAnalyzer?.initialized) {
            initializeAnalysis();
        }
        
        // If analysis was disabled, disable highlighting but preserve stats
        if (!analysisEnabled) {
            // Save current statistics before modifying anything
            if (analysisWasPerformed) {
                lastKnownCounts = {
                    totalAnalyzed,
                    highlightCount,
                    fakeNewsCount,
                    clickbaitOnlyCount,
                    bothCount
                };
            }
            
            highlightingEnabled = false;
            removeHighlights(false); // Pass false to not reset statistics
        } else {
            // If highlighting state was also provided, update it
            if (request.highlightingEnabled !== undefined) {
                highlightingEnabled = request.highlightingEnabled;
                if (highlightingEnabled) {
                    processPage();
                } else {
                    removeHighlights(false); // Pass false to not reset statistics
                }
            }
        }
    }
    
    // 2. For the site status issue, we'll check site status when getting stats too
    
    // Return statistics and site status when requested, even if analysis is off
    if (request.action === 'getStats') {
        // Make sure we know if this is a news site
        isNewsSite((isNews) => {
            currentSiteIsNews = isNews;
            
            // If analysis hasn't been performed or is in progress, return zeros
            if (!analysisWasPerformed || analysisInProgress) {
                sendResponse({
                    totalAnalyzed: 0,
                    highlightCount: 0,
                    fakeNewsCount: 0,
                    clickbaitOnlyCount: 0,
                    bothCount: 0,
                    isNewsSite: currentSiteIsNews,
                    analysisInProgress: analysisInProgress
                });
                return;
            }
            
            // Return either current stats or last known stats if analysis is disabled
            const stats = !analysisEnabled && analysisWasPerformed ? lastKnownCounts : {
                totalAnalyzed,
                highlightCount,
                fakeNewsCount,
                clickbaitOnlyCount,
                bothCount
            };
            
            sendResponse({
                ...stats,
                isNewsSite: currentSiteIsNews,
                analysisInProgress: false
            });
        });
        return true; // Async response will happen later
    }
    
    // Site status messages should be handled regardless of analysis being enabled
    if (request.action === 'siteStatusChanged') {
        console.log('Site status change notification received:', request);
        
        // Force a fresh check of the site status
        isNewsSite((isNews) => {
            // Use forced status if provided, otherwise use the check result
            currentSiteIsNews = request.forceNewsStatus !== undefined ? 
                request.forceNewsStatus : isNews;
            
            console.log(`Site status after check: ${currentSiteIsNews ? 'News Site' : 'Non-News Site'}`);
            
            // Always reset the page processed flag
            pageProcessedFlag = false;
            window.pageProcessed = false; // Also reset legacy flag for compatibility
            
            if (currentSiteIsNews) {
                // If this is a news site and analysis is enabled, process the page
                if (analysisEnabled) {
                    console.log('Site is a news site, analysis enabled, processing content');
                    
                    // If forceAnalysis flag is true, immediately process content
                    if (request.forceAnalysis) {
                        console.log('Force processing page content immediately');
                        processPageContent();
                    } else {
                        // Otherwise use the standard process flow
                        processPage();
                    }
                } else {
                    console.log('Analysis is disabled, not processing content');
                }
            } else {
                console.log('Site is not a news site, removing highlights');
                removeHighlights();
                // Reset statistics
                totalAnalyzed = 0;
                highlightCount = 0;
                fakeNewsCount = 0;
                clickbaitOnlyCount = 0;
                bothCount = 0;
            }
            
            // Send response if a callback was provided
            if (sendResponse) {
                sendResponse({ 
                    success: true, 
                    isNewsSite: currentSiteIsNews 
                });
            }
        }, true); // Force check
        
        return true; // Indicates async response
    }
    
    // Return statistics and site status when requested, even if analysis is off
    if (request.action === 'getStats') {
        // First make sure we know if this is a news site
        if (!currentSiteIsNews) {
            isNewsSite((isNews) => {
                currentSiteIsNews = isNews;
                sendResponse({
                    totalAnalyzed: totalAnalyzed,
                    highlightCount: highlightCount,
                    fakeNewsCount: fakeNewsCount,
                    clickbaitOnlyCount: clickbaitOnlyCount,
                    bothCount: bothCount,
                    isNewsSite: currentSiteIsNews
                });
            });
            return true; // Async response will happen later
        }
        
        // Otherwise we already know the site status
        sendResponse({
            totalAnalyzed: totalAnalyzed,
            highlightCount: highlightCount,
            fakeNewsCount: fakeNewsCount,
            clickbaitOnlyCount: clickbaitOnlyCount,
            bothCount: bothCount,
            isNewsSite: currentSiteIsNews
        });
        return true;
    }
});

// Add a listener to respond with stats
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getStats') {
        sendResponse({
            totalAnalyzed,
            highlightCount,
            fakeNewsCount,
            clickbaitOnlyCount,
            bothCount,
            isNewsSite: currentSiteIsNews
        });
    }
});

// Run the main function when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAnalysis);
} else {
    initializeAnalysis();
}

// 4. Check site status immediately when content script loads, before analysis
// Add this right after the declaration of currentSiteIsNews
isNewsSite((isNews) => {
    currentSiteIsNews = isNews;
    console.log(`Site determined to be ${isNews ? 'a news site' : 'not a news site'} on initial load`);
});
