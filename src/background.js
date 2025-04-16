// src/background.js

// Define cache parameters
const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const domainCache = {};

let defaultNewsDomains = [];

// Load news domains from JSON file
fetch(chrome.runtime.getURL('newsDomains.json'))
  .then(response => response.json())
  .then(domains => {
    defaultNewsDomains = domains;
    console.log('Loaded news domains:', defaultNewsDomains);
  })
  .catch(error => {
    console.error('Error loading news domains:', error);
    // Fallback to default domains if JSON loading fails
    defaultNewsDomains = [
      'nytimes', 'washingtonpost', 'theguardian', 'bbc', 'cnn',
      'foxnews', 'reuters', 'apnews', 'thehill', 'npr',
      'wsj', 'economist', 'time', 'usatoday', 'latimes'
    ];
  });

/**
 * Extracts the base domain from a URL
 * @param {string} url - The URL to extract from
 * @returns {string} - The extracted base domain
 */
function extractBaseDomain(url) {
    try {
        // Extract hostname from URL
        let hostname = url;
        
        // Handle if input is a full URL
        if (url.includes('://')) {
            hostname = new URL(url).hostname;
        }
        
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
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    if (message.action === 'checkNewsSite') {
        // Get the domain parameter
        const domain = message.domain;
        
        if (!domain) {
            console.error('No domain provided in message');
            sendResponse({ isNewsSite: false, error: 'No domain provided' });
            return true;
        }
        
        // Create a safety timeout to ensure we always respond
        const safetyTimeout = setTimeout(() => {
            console.warn('Safety timeout triggered for domain check:', domain);
            sendResponse({ 
                isNewsSite: false, 
                error: 'Safety timeout',
                domain: domain 
            });
        }, 2000);
        
        checkIfNewsSiteCached(domain)
            .then((isNewsSite) => {
                clearTimeout(safetyTimeout);
                console.log(`Domain check complete for ${domain}: ${isNewsSite}`);
                sendResponse({ isNewsSite, domain });
            })
            .catch((error) => {
                clearTimeout(safetyTimeout);
                console.error('Error checking news site:', error);
                sendResponse({ isNewsSite: false, error: error.message, domain });
            });
            
        return true; // Indicates that sendResponse will be called asynchronously
    }
    
    // Handle adding a news site (make sure it goes to sync storage)
    if (message.action === 'addNewsSite') {
        chrome.storage.sync.get(['customNewsSites'], (result) => {
            const customSites = result.customNewsSites || [];
            const baseDomain = extractSiteName(message.domain.toLowerCase());
            
            console.log('Adding to custom news sites:', baseDomain);
            
            // Check if the domain is already in the list
            if (!customSites.includes(baseDomain)) {
                customSites.push(baseDomain);
                chrome.storage.sync.set({ customNewsSites: customSites }, () => {
                    console.log('Custom news sites updated:', customSites);
                });
            }
            
            // Send response back
            sendResponse({ success: true });
        });
        
        return true;
    }
    
    // Handle removing a news site (from sync storage)
    if (message.action === 'removeNewsSite') {
        chrome.storage.sync.get(['customNewsSites'], (result) => {
            const customSites = result.customNewsSites || [];
            const baseDomain = extractSiteName(message.domain.toLowerCase());
            
            console.log('Removing from custom news sites:', baseDomain);
            
            // Remove domain from the list
            const updatedSites = customSites.filter(site => site !== baseDomain);
            chrome.storage.sync.set({ customNewsSites: updatedSites }, () => {
                console.log('Updated custom news sites:', updatedSites);
            });
            
            // Clear from cache if it exists
            if (domainCache[baseDomain]) {
                delete domainCache[baseDomain];
            }
            
            // Send response back
            sendResponse({ success: true });
        });
        
        return true;
    }
    
    // Handle adding a news site
    if (message.action === 'addNewsSite') {
        chrome.storage.local.get(['newsSites'], (result) => {
            const newsSites = result.newsSites || [];
            const domain = message.domain.toLowerCase();
            
            // Check if the domain is already in the list
            if (!newsSites.includes(domain)) {
                newsSites.push(domain);
                chrome.storage.local.set({ newsSites: newsSites });
            }
            
            // Send response back
            sendResponse({ success: true });
        });
        
        return true;
    }
    
    // Handle removing a news site
    if (message.action === 'removeNewsSite') {
        chrome.storage.local.get(['newsSites'], (result) => {
            const newsSites = result.newsSites || [];
            const domain = message.domain.toLowerCase();
            
            // Remove domain from the list
            const updatedSites = newsSites.filter(site => site !== domain);
            chrome.storage.local.set({ newsSites: updatedSites });
            
            // Send response back
            sendResponse({ success: true });
        });
        
        return true;
    }
});

// Add an emergency fallback handler for getCurrentTabInfo requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getCurrentTabInfo') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0] || !tabs[0].url) {
                sendResponse({ 
                    error: 'No active tab found',
                    domain: 'unknown',
                    isNewsSite: false
                });
                return;
            }
            
            try {
                const url = new URL(tabs[0].url);
                const domain = url.hostname;
                
                // Respond immediately with basic info
                sendResponse({
                    tabId: tabs[0].id,
                    domain: domain,
                    isNewsSite: false // Default, will be updated later
                });
                
            } catch (e) {
                sendResponse({ 
                    error: 'Error parsing URL',
                    domain: 'error',
                    isNewsSite: false
                });
            }
        });
        
        return true; // Indicates async response
    }
});

/**
 * Checks if a given domain belongs to a news site using newsDomains and custom sites.
 * @param {string} domain - The domain name to check.
 * @returns {Promise<boolean>} - Resolves to true if it's a news site, else false.
 */
async function checkIfNewsSiteCached(domain) {
    const now = Date.now();
    
    if (!domain) {
        console.error('No domain provided');
        return false;
    }
    
    console.log('Checking domain:', domain);
    
    // Clean up domain and extract the site name without TLD
    const siteName = extractSiteName(domain);
    console.log('Checking news site for:', siteName);

    // Check if the site name is in the cache
    if (domainCache[siteName]) {
        const cachedEntry = domainCache[siteName];
        if (now - cachedEntry.timestamp < cacheDuration) {
            return cachedEntry.isNewsSite;
        }
    }

    try {
        // First check for user-added custom sites in sync storage
        const syncResult = await chrome.storage.sync.get(['customNewsSites']);
        const customSites = syncResult.customNewsSites || [];
        
        if (customSites.includes(siteName)) {
            console.log(`${siteName} is a custom news site`);
            
            // Cache the result
            domainCache[siteName] = {
                isNewsSite: true,
                timestamp: now,
                source: 'custom'
            };
            
            return true;
        }
        
        // If not in custom sites, check the default/built-in news sites
        const isDefaultNewsSite = defaultNewsDomains.includes(siteName);
        
        console.log(`Is ${siteName} a default news site? ${isDefaultNewsSite}`);

        // Cache the result
        domainCache[siteName] = {
            isNewsSite: isDefaultNewsSite,
            timestamp: now,
            source: isDefaultNewsSite ? 'default' : 'none'
        };

        return isDefaultNewsSite;
    } catch (error) {
        console.error('Error checking if news site:', error);
        return false;
    }
}

/**
 * Extracts the site name from a domain (removes TLD and www)
 * @param {string} domain - The domain to process
 * @returns {string} - The extracted site name
 */
function extractSiteName(domain) {
    // Clean up domain if it contains protocol or www
    let baseDomain = domain;
    if (baseDomain.startsWith('www.')) {
        baseDomain = baseDomain.slice(4);
    }
    if (baseDomain.startsWith('http://')) {
        baseDomain = baseDomain.slice(7);
    } else if (baseDomain.startsWith('https://')) {
        baseDomain = baseDomain.slice(8);
    }

    // Extract the base domain (without TLD)
    let siteName = baseDomain;
    if (baseDomain.includes('.')) {
        const parts = baseDomain.split('.');
        if (parts.length >= 2) {
            // For domains like co.uk, com.au, we want the part before these
            if ((parts.length > 2) && 
                (parts[parts.length - 2] === 'co' || 
                parts[parts.length - 2] === 'com')) {
                siteName = parts[parts.length - 3];
            } else {
                siteName = parts[0];
            }
        }
    }
    
    return siteName;
}

// Store news sites in storage
chrome.runtime.onInstalled.addListener(() => {
  // Initialize with default news sites
  chrome.storage.local.get(['newsSites', 'highlightingEnabled'], (result) => {
    // If newsSites is not set, initialize it with default values
    if (!result.newsSites) {
      chrome.storage.local.set({ newsSites: defaultNewsDomains });
    }
    
    // If highlightingEnabled is not set, initialize it to true
    if (result.highlightingEnabled === undefined) {
      chrome.storage.local.set({ highlightingEnabled: true });
    }
  });
});
