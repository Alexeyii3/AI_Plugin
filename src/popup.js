// popup.js

// Clean up global variables (removing duplicate declarations)
let currentTabId = null;
let currentDomain = ''; // Moved from DOMContentLoaded scope to global scope
let currentBaseDomain = '';
let currentIsNewsSite = false;
let isValidTabForContentScript = true;

document.addEventListener('DOMContentLoaded', () => {
    // Reference to UI elements that need updating
    const highlightToggle = document.getElementById('highlightToggle');
    const analysisToggle = document.getElementById('analysisToggle');
    const currentSite = document.getElementById('currentSite');
    const siteBadge = document.getElementById('siteBadge');
    const totalAnalyzed = document.getElementById('totalAnalyzed');
    const highlightCount = document.getElementById('highlightCount');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const customSitesList = document.getElementById('customSitesList');
    const emptySitesMessage = document.getElementById('emptySitesMessage');
    
    // Make sure we have default display states while loading
    currentSite.textContent = "Loading...";
    siteBadge.textContent = "Loading...";
    totalAnalyzed.textContent = "...";
    highlightCount.textContent = "...";
    document.getElementById('fakeNewsCount').textContent = "...";
    document.getElementById('clickbaitCount').textContent = "...";
    document.getElementById('bothCount').textContent = "...";
    
    // Initialize toggle states and load data immediately when popup opens
    initializePopup();
    
    // Function to handle all popup initialization in the correct order
    async function initializePopup() {
        // First step: Load toggle states from storage
        await loadToggleStates();
        
        // Second step: Get current tab information
        await getCurrentTabInfo();
        
        // Third step: Load custom sites list
        loadCustomSites();
        
        // Fourth step: If we're on a valid tab, get latest stats
        if (isValidTabForContentScript && currentTabId) {
            updateStats(currentTabId);
        }
    }
    
    // Load toggle states from storage
    function loadToggleStates() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['highlightingEnabled', 'analysisEnabled'], (result) => {
                // Default both to true if not set
                const isHighlightingEnabled = result.highlightingEnabled !== false;
                const isAnalysisEnabled = result.analysisEnabled !== false;
                
                highlightToggle.checked = isHighlightingEnabled;
                analysisToggle.checked = isAnalysisEnabled;
                
                // Disable the highlight toggle if analysis is off
                highlightToggle.disabled = !isAnalysisEnabled;
                
                resolve();
            });
        });
    }
    
    // Get the current tab info more reliably
    function getCurrentTabInfo() {
        return new Promise((resolve) => {
            // Set a timeout to prevent getting stuck in loading state
            const timeoutId = setTimeout(() => {
                console.error('Timed out while getting tab info');
                
                // Update UI with fallback values if we time out
                currentSite.textContent = "Timeout Error";
                siteBadge.textContent = "Unknown";
                siteBadge.className = 'site-badge non-news';
                
                resolve();
            }, 5000);
            
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                // Clear the timeout as we got a response
                clearTimeout(timeoutId);
                console.log('Got tabs response:', tabs);
                
                if (!tabs || tabs.length === 0) {
                    currentSite.textContent = "Unknown site";
                    siteBadge.textContent = "Unknown";
                    isValidTabForContentScript = false;
                    resolve();
                    return;
                }
                
                const tab = tabs[0];
                currentTabId = tab.id;
                
                // Check if this is a valid tab for content scripts
                if (!isValidUrl(tab.url)) {
                    currentSite.textContent = "System page";
                    siteBadge.textContent = "Not applicable";
                    siteBadge.classList.add('non-news');
                    isValidTabForContentScript = false;
                    
                    // Show N/A for stats on invalid tabs
                    totalAnalyzed.textContent = "N/A";
                    highlightCount.textContent = "N/A";
                    document.getElementById('fakeNewsCount').textContent = "N/A";
                    document.getElementById('clickbaitCount').textContent = "N/A";
                    document.getElementById('bothCount').textContent = "N/A";
                    
                    resolve();
                    return;
                }
                
                try {
                    const url = new URL(tab.url);
                    currentDomain = url.hostname;
                    
                    // IMPORTANT: Set domain name immediately so it always shows
                    console.log('Current domain:', currentDomain);
                    currentSite.textContent = currentDomain || "Unknown site";
                    
                    // Extract base domain for news site checking
                    currentBaseDomain = extractBaseDomain(currentDomain);
                    console.log(`Extracted domain: ${currentBaseDomain} from ${currentDomain}`);
                    
                    // Emergency direct update in case the rest fails
                    setTimeout(() => {
                        if (siteBadge.textContent === "Loading...") {
                            console.log("Emergency fallback: Updating badge");
                            siteBadge.textContent = "Status Unknown";
                            siteBadge.className = 'site-badge non-news';
                        }
                    }, 2000);
                    
                    // First check in sync storage for user-added sites
                    chrome.storage.sync.get(['customNewsSites'], (syncResult) => {
                        console.log('Got custom sites:', syncResult);
                        const customSites = syncResult.customNewsSites || [];
                        
                        // Check if site is in custom list
                        if (customSites.includes(currentBaseDomain)) {
                            currentIsNewsSite = true;
                            siteBadge.textContent = 'News Site';
                            siteBadge.className = 'site-badge news'; // CONSISTENT CLASS NAME
                            updateAddRemoveButton();
                            resolve();
                        } else {
                            console.log('Sending checkNewsSite message to background script');
                            // Then check built-in news sites list via background script
                            
                            // Create an additional timeout specifically for the message request
                            const msgTimeoutId = setTimeout(() => {
                                console.error('Background script did not respond in time');
                                siteBadge.textContent = 'Timeout Error';
                                siteBadge.className = 'site-badge non-news';
                                updateAddRemoveButton();
                                resolve();
                            }, 3000);
                            
                            try {
                                chrome.runtime.sendMessage(
                                    { action: 'checkNewsSite', domain: currentBaseDomain },
                                    (response) => {
                                        // Clear message timeout as we got a response
                                        clearTimeout(msgTimeoutId);
                                        console.log('Got response from background:', response);
                                        
                                        // Handle case when background script doesn't respond
                                        if (!response) {
                                            console.error('No response from background script');
                                            siteBadge.textContent = 'Error';
                                            siteBadge.className = 'site-badge non-news';
                                            updateAddRemoveButton();
                                            resolve();
                                            return;
                                        }
                                        
                                        if (response.isNewsSite) {
                                            currentIsNewsSite = true;
                                            siteBadge.textContent = 'News Site';
                                            siteBadge.className = 'site-badge news';
                                        } else {
                                            currentIsNewsSite = false;
                                            siteBadge.textContent = 'Non-News Site';
                                            siteBadge.className = 'site-badge non-news';
                                        }
                                        
                                        updateAddRemoveButton();
                                        resolve();
                                    }
                                );
                            } catch (err) {
                                // Clear message timeout if there was an error
                                clearTimeout(msgTimeoutId);
                                console.error('Error sending message to background script:', err);
                                siteBadge.textContent = 'Error';
                                siteBadge.className = 'site-badge non-news';
                                updateAddRemoveButton();
                                resolve();
                            }
                        }
                    });
                } catch (e) {
                    console.error("Error processing tab URL:", e);
                    currentSite.textContent = "Error: " + e.message;
                    siteBadge.textContent = "Error";
                    siteBadge.className = 'site-badge non-news';
                    isValidTabForContentScript = false;
                    resolve();
                }
            });
        });
    }
    
    // Update the Add/Remove button text based on current site status
    function updateAddRemoveButton() {
        if (currentIsNewsSite) {
            addSiteBtn.textContent = 'Remove Site';
            addSiteBtn.classList.remove('add-button');
            addSiteBtn.classList.add('remove-button');
        } else {
            addSiteBtn.textContent = 'Add as News';
            addSiteBtn.classList.remove('remove-button');
            addSiteBtn.classList.add('add-button');
        }
    }
    
    // Check if the current tab URL is valid for content script injection
    function isValidUrl(url) {
        return url && !url.startsWith('chrome://') && 
               !url.startsWith('chrome-extension://') &&
               !url.startsWith('chrome-search://') &&
               !url.startsWith('about:') &&
               !url.startsWith('edge://') &&
               !url.startsWith('brave://') &&
               !url.startsWith('devtools://');
    }
    
    // Handle toggle changes
    highlightToggle.addEventListener('change', () => {
        const isEnabled = highlightToggle.checked;
        // Save to storage
        chrome.storage.local.set({ highlightingEnabled: isEnabled });
        
        // Only send message if we're on a valid tab
        if (isValidTabForContentScript) {
            // Notify content script
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && isValidUrl(tabs[0].url)) {
                    chrome.tabs.sendMessage(tabs[0].id, { highlightingEnabled: isEnabled }, (response) => {
                        // Handle potential error
                        if (chrome.runtime.lastError) {
                            console.log('Error sending message:', chrome.runtime.lastError.message);
                            // No need to do anything else, the error is expected in some contexts
                        }
                    });
                }
            });
        }
        
        // Show a nice ripple effect on toggle
        const ripple = document.createElement('span');
        ripple.classList.add('toggle-ripple');
        document.querySelector('.toggle').appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
    });
    
    // Handle analysis toggle changes
    analysisToggle.addEventListener('change', () => {
        const isEnabled = analysisToggle.checked;
        
        // Save to storage
        chrome.storage.local.set({ analysisEnabled: isEnabled });
        
        // Enable/disable the highlighting toggle based on analysis state
        highlightToggle.disabled = !isEnabled;
        
        // If analysis is turned off, ensure highlighting is also off
        if (!isEnabled && highlightToggle.checked) {
            highlightToggle.checked = false;
            chrome.storage.local.set({ highlightingEnabled: false });
        }
        
        // Notify content script of change
        if (isValidTabForContentScript) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs.length > 0 && isValidUrl(tabs[0].url)) {
                    chrome.tabs.sendMessage(tabs[0].id, { 
                        analysisEnabled: isEnabled,
                        highlightingEnabled: isEnabled ? highlightToggle.checked : false
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('Error sending message:', chrome.runtime.lastError.message);
                        }
                    });
                }
            });
        }
        
        // Show a nice ripple effect on toggle
        const ripple = document.createElement('span');
        ripple.classList.add('toggle-ripple');
        analysisToggle.parentElement.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
    });
    
    // Function to extract base domain (without TLD)
    function extractBaseDomain(domain) {
        if (!domain) return '';
        
        // Remove www if present
        let baseDomain = domain;
        if (baseDomain.startsWith('www.')) {
            baseDomain = baseDomain.slice(4);
        }
        
        // Extract just the site name without TLD
        const parts = baseDomain.split('.');
        
        // Special case for country-code TLDs with second-level domains
        if (parts.length > 2) {
            // Common second-level domains in country-code TLDs
            const secondLevelDomains = ['co', 'com', 'net', 'org', 'ac', 'edu', 'gov'];
            
            if (secondLevelDomains.includes(parts[parts.length - 2])) {
                return parts[parts.length - 3]; // Return the part before the second-level domain
            }
        }
        
        // Standard case (example.com) - return the first part
        if (parts.length >= 2) {
            return parts[0];
        }
        
        return baseDomain;
    }
    
    // Load custom sites from storage
    function loadCustomSites() {
        chrome.storage.sync.get(['customNewsSites'], (result) => {
            const customSites = result.customNewsSites || [];
            console.log('Loaded custom sites:', customSites);
            
            // Update UI
            if (customSitesList) { // Make sure the element exists
                if (customSites.length > 0) {
                    emptySitesMessage.style.display = 'none';
                    customSitesList.innerHTML = '';
                    
                    customSites.forEach(site => {
                        const li = document.createElement('li');
                        li.className = 'site-item';
                        li.innerHTML = `
                            <span>${site}</span>
                            <button class="delete-site" data-site="${site}">&times;</button>
                        `;
                        customSitesList.appendChild(li);
                    });
                    
                    // Add event listeners to delete buttons
                    document.querySelectorAll('.delete-site').forEach(button => {
                        button.addEventListener('click', function() {
                            const site = this.getAttribute('data-site');
                            removeCustomSite(site);
                        });
                    });
                } else {
                    emptySitesMessage.style.display = 'block';
                    customSitesList.innerHTML = '';
                }
            }
        });
    }
    
    // Add current site to custom news sites - standardize on one implementation
    function addCurrentSite() {
        if (!currentBaseDomain) return;
        
        chrome.storage.sync.get(['customNewsSites'], (result) => {
            const customSites = result.customNewsSites || [];
            
            // Check if site already exists
            if (customSites.includes(currentBaseDomain)) {
                showMessage('This site is already in your list', 'error');
                return;
            }
            
            console.log(`Adding ${currentBaseDomain} to custom news sites`);
            
            // Add the site and save
            customSites.push(currentBaseDomain);
            chrome.storage.sync.set({ customNewsSites: customSites }, () => {
                loadCustomSites();
                showMessage(`Added ${currentBaseDomain} to news sites`, 'success');
                
                // Update the badge to show it's now a news site
                siteBadge.textContent = 'News Site';
                siteBadge.classList.remove('non-news');
                siteBadge.classList.add('news');
                
                // Update local state
                currentIsNewsSite = true;
                updateAddRemoveButton();
                
                // Explicitly request analysis for the current tab after adding as news site
                if (isValidTabForContentScript && currentTabId) {
                    console.log('Requesting immediate analysis after adding news site');
                    chrome.tabs.sendMessage(currentTabId, {
                        action: 'siteStatusChanged',
                        forceNewsStatus: true, // Force the news site status to true
                        shouldRemoveHighlights: false,
                        forceAnalysis: true  // Force analysis to run immediately
                    }, (response) => {
                        if (response && response.success) {
                            console.log('Site status update successful:', response);
                        }
                        
                        // After a short delay, refresh stats to show new results
                        setTimeout(() => updateStats(currentTabId), 1500);
                    });
                }
                
                // Also send the addNewsSite message to the background script to keep it in sync
                chrome.runtime.sendMessage({
                    action: 'addNewsSite',
                    domain: currentBaseDomain
                }, (response) => {
                    console.log('Background script response:', response);
                });
                
                // Notify ALL other tabs that might be open to this site
                notifyAllTabsOfSiteStatusChange(currentBaseDomain, true);
            });
        });
    }
    
    // Remove a site from custom news sites
    function removeCustomSite(site) {
        chrome.storage.sync.get(['customNewsSites'], (result) => {
            let customSites = result.customNewsSites || [];
            
            // Only continue if the site exists in the list
            if (!customSites.includes(site)) {
                showMessage('Site not found in your list', 'error');
                return;
            }
            
            console.log(`Removing ${site} from custom news sites`);
            
            customSites = customSites.filter(s => s !== site);
            chrome.storage.sync.set({ customNewsSites: customSites }, () => {
                loadCustomSites();
                showMessage(`Removed ${site} from news sites`, 'success');
                
                // Update the badge if we removed the current site
                if (site === currentBaseDomain) {
                    // First check if it might still be a default news site
                    chrome.runtime.sendMessage(
                        { action: 'checkNewsSite', domain: site },
                        (response) => {
                            const isStillNewsSite = response && response.isNewsSite;
                            
                            if (isStillNewsSite) {
                                siteBadge.textContent = 'News Site (Default)';
                                siteBadge.className = 'site-badge news';
                                currentIsNewsSite = true;
                            } else {
                                siteBadge.textContent = 'Non-News Site';
                                siteBadge.className = 'site-badge non-news';
                                currentIsNewsSite = false;
                            }
                            
                            updateAddRemoveButton();
                        }
                    );
                }
                
                // Also notify the background script about the removal
                chrome.runtime.sendMessage({
                    action: 'removeNewsSite',
                    domain: site
                });
                
                // Notify ALL tabs that might be open to this site
                notifyAllTabsOfSiteStatusChange(site, false);
            });
        });
    }
    
    // Add test button functionality
    document.getElementById('runTests').addEventListener('click', () => {
        // Get the active tab and run tests
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.executeScript(
                tabs[0].id,
                { code: 'console.log("Running AI model tests from popup"); if(window.runAIModelTests) { window.runAIModelTests(); }' }
            );
        });
    });
    
    // Function to update statistics in the UI
    function updateStats(tabId) {
        // Default to zeros for stats (will show when loading or if no analysis has run)
        document.getElementById('totalAnalyzed').textContent = "0";
        document.getElementById('highlightCount').textContent = "0";
        document.getElementById('fakeNewsCount').textContent = "0";
        document.getElementById('clickbaitCount').textContent = "0";
        document.getElementById('bothCount').textContent = "0";
        
        chrome.tabs.sendMessage(tabId, { action: 'getStats' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting stats:', chrome.runtime.lastError);
                return;
            }
            
            if (!response) return;
            
            // If analysis is in progress, don't update stats yet, but keep checking
            if (response.analysisInProgress) {
                console.log('Analysis in progress, will check again soon');
                setTimeout(() => updateStats(tabId), 1000); // Check again in a second
                return;
            }
            
            // Update basic stats only if analysis was completed
            document.getElementById('totalAnalyzed').textContent = response.totalAnalyzed || 0;
            document.getElementById('highlightCount').textContent = response.highlightCount || 0;
            
            // Update detailed stats
            document.getElementById('fakeNewsCount').textContent = response.fakeNewsCount || 0;
            document.getElementById('clickbaitCount').textContent = response.clickbaitOnlyCount || 0;
            document.getElementById('bothCount').textContent = response.bothCount || 0;
            
            // Add animation for stats
            document.getElementById('totalAnalyzed').classList.add('count-animation');
            document.getElementById('highlightCount').classList.add('count-animation');
            document.getElementById('fakeNewsCount').classList.add('count-animation');
            document.getElementById('clickbaitCount').classList.add('count-animation');
            document.getElementById('bothCount').classList.add('count-animation');
            
            // Always update site badge based on response
            const siteBadge = document.getElementById('siteBadge');
            if (siteBadge) {
                siteBadge.textContent = response.isNewsSite ? 'News Site' : 'Non-News Site';
                siteBadge.className = 'site-badge ' + (response.isNewsSite ? 'news' : 'non-news');
            }
            
            console.log('Statistics updated:', response);
        });
    }

    // Add a refresh button listener to update stats manually if needed
    document.getElementById('refreshStats').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0 && isValidUrl(tabs[0].url)) {
                updateStats(tabs[0].id);
            }
        });
    });
});

// Function to update UI based on site status
function updateSiteStatus(isNewsSite, domain) {
    const siteBadge = document.getElementById('siteBadge');
    const currentSite = document.getElementById('currentSite');
    
    // Update site name display
    if (currentSite) {
        currentSite.textContent = domain || 'unknown';
    }
    
    // Update badge based on news site status
    if (siteBadge) {
        if (isNewsSite) {
            siteBadge.textContent = 'News Site';
            siteBadge.classList.remove('non-news');
            siteBadge.classList.add('news'); // CONSISTENT CLASS NAME
        } else {
            siteBadge.textContent = 'Non-News Site';
            siteBadge.classList.remove('news');
            siteBadge.classList.add('non-news'); // CONSISTENT CLASS NAME
        }
    }
    
    // Update add/remove site button
    const addSiteBtn = document.getElementById('addSiteBtn');
    if (addSiteBtn) {
        if (isNewsSite) {
            addSiteBtn.textContent = 'Remove Site';
            addSiteBtn.classList.remove('add-button');
            addSiteBtn.classList.add('remove-button');
        } else {
            addSiteBtn.textContent = 'Add as News';
            addSiteBtn.classList.remove('remove-button');
            addSiteBtn.classList.add('add-button');
        }
    }
}

// Function to refresh highlighting status
function refreshHighlightingStatus() {
    chrome.storage.local.get(['highlightingEnabled'], (result) => {
        const highlightToggle = document.getElementById('highlightToggle');
        if (highlightToggle) {
            highlightToggle.checked = result.highlightingEnabled !== false;
        }
    });
}

// Function to load and display custom news sites
function loadCustomSites() {
    chrome.storage.local.get(['newsSites'], (result) => {
        const customSitesList = document.getElementById('customSitesList');
        const emptySitesMessage = document.getElementById('emptySitesMessage');
        
        if (customSitesList) {
            // Clear existing list
            customSitesList.innerHTML = '';
            
            const newsSites = result.newsSites || [];
            
            // Add each site to the list
            if (newsSites.length > 0) {
                emptySitesMessage.style.display = 'none';
                customSitesList.style.display = 'block';
                
                newsSites.forEach(site => {
                    const listItem = document.createElement('li');
                    listItem.className = 'site-item';
                    
                    const siteName = document.createElement('span');
                    siteName.textContent = site;
                    siteName.className = 'site-name';
                    
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = '×';
                    removeBtn.className = 'site-remove';
                    removeBtn.addEventListener('click', () => removeSite(site));
                    
                    listItem.appendChild(siteName);
                    listItem.appendChild(removeBtn);
                    customSitesList.appendChild(listItem);
                });
            } else {
                emptySitesMessage.style.display = 'block';
                customSitesList.style.display = 'none';
            }
        }
    });
}

// Function to add current site to news sites
function addCurrentSite() {
    if (!currentDomain) return;
    
    // Get the active tab ID to send with the message
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            const activeTabId = tabs[0].id;
            
            chrome.runtime.sendMessage({
                action: 'addNewsSite',
                domain: currentDomain,
                tabId: activeTabId
            }, (response) => {
                if (response && response.success) {
                    currentIsNewsSite = true;
                    updateSiteStatus(true, currentDomain);
                    loadCustomSites();
                    
                    // Show feedback to the user
                    const siteBadge = document.getElementById('siteBadge');
                    if (siteBadge) {
                        siteBadge.textContent = 'News Site';
                        siteBadge.className = 'site-badge news-site';
                        // Add a brief animation to draw attention
                        siteBadge.style.animation = 'none';
                        setTimeout(() => {
                            siteBadge.style.animation = 'pulse 0.5s';
                        }, 10);
                    }
                    
                    // Update the button text
                    const addSiteBtn = document.getElementById('addSiteBtn');
                    if (addSiteBtn) {
                        addSiteBtn.textContent = 'Remove Site';
                        addSiteBtn.classList.remove('add-button');
                        addSiteBtn.classList.add('remove-button');
                    }
                    
                    // Request immediate analysis from the content script
                    chrome.tabs.sendMessage(activeTabId, {
                        action: 'siteStatusChanged',
                        isNewsSite: true,
                        shouldRemoveHighlights: false
                    }, () => {
                        // After a short delay, refresh the stats to show new analysis results
                        setTimeout(refreshStats, 1000);
                    });
                }
            });
        }
    });
}

// Function to remove site from news sites
function removeSite(domain) {
    // Get the active tab ID to send with the message
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        const activeTabId = tabs[0] ? tabs[0].id : null;
        
        chrome.runtime.sendMessage({
            action: 'removeNewsSite',
            domain: domain,
            tabId: activeTabId
        }, (response) => {
            if (response && response.success) {
                loadCustomSites();
                
                // If this was the current site, update UI
                if (domain === currentDomain) {
                    currentIsNewsSite = false;
                    updateSiteStatus(false, currentDomain);
                    
                    // Show feedback to the user
                    const siteBadge = document.getElementById('siteBadge');
                    if (siteBadge) {
                        siteBadge.textContent = 'Non-News Site';
                        siteBadge.className = 'site-badge non-news';
                        // Add a brief animation to draw attention
                        siteBadge.style.animation = 'none';
                        setTimeout(() => {
                            siteBadge.style.animation = 'pulse 0.5s';
                        }, 10);
                    }
                    
                    // Update the button text
                    const addSiteBtn = document.getElementById('addSiteBtn');
                    if (addSiteBtn) {
                        addSiteBtn.textContent = 'Add as News';
                        addSiteBtn.classList.remove('remove-button');
                        addSiteBtn.classList.add('add-button');
                    }
                    
                    // Notify the content script to remove highlights if this is the current site
                    if (activeTabId) {
                        chrome.tabs.sendMessage(activeTabId, {
                            action: 'siteStatusChanged',
                            isNewsSite: false,
                            shouldRemoveHighlights: true
                        }, () => {
                            // After a short delay, refresh the stats to show updated info
                            setTimeout(refreshStats, 500);
                        });
                    }
                }
            }
        });
    });
}

// Function to toggle current site (add or remove)
function toggleCurrentSite() {
    if (currentIsNewsSite) {
        removeSite(currentDomain);
    } else {
        addCurrentSite();
    }
}

// Function to get current tab information
function getCurrentTabInfo() {
    chrome.runtime.sendMessage({ action: 'getCurrentTabInfo' }, (response) => {
        if (response && !response.error) {
            currentTabId = response.tabId;
            currentDomain = response.domain;
            currentIsNewsSite = response.isNewsSite;
            
            // Update UI with current site info
            updateSiteStatus(currentIsNewsSite, currentDomain);
        }
    });
}

// Function to refresh statistics from content script
function refreshStats() {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'getStats' }, (response) => {
                if (response && !chrome.runtime.lastError) {
                    // Update stats in the UI
                    document.getElementById('totalAnalyzed').textContent = response.totalAnalyzed || 0;
                    document.getElementById('highlightCount').textContent = response.highlightCount || 0;
                    document.getElementById('fakeNewsCount').textContent = response.fakeNewsCount || 0;
                    document.getElementById('clickbaitCount').textContent = response.clickbaitOnlyCount || 0;
                    document.getElementById('bothCount').textContent = response.bothCount || 0;
                    
                    // Make sure the site status is in sync
                    if (response.isNewsSite !== currentIsNewsSite) {
                        currentIsNewsSite = response.isNewsSite;
                        updateSiteStatus(currentIsNewsSite, currentDomain);
                    }
                }
            });
        }
    });
}

// Setup event listeners when popup loads
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the popup
    getCurrentTabInfo();
    refreshHighlightingStatus();
    loadCustomSites();
    refreshStats();
    
    // Set up event listeners
    document.getElementById('addSiteBtn').addEventListener('click', toggleCurrentSite);
    
    document.getElementById('highlightToggle').addEventListener('change', (e) => {
        const isEnabled = e.target.checked;
        chrome.storage.local.set({ highlightingEnabled: isEnabled });
        
        // Send message to content script to enable/disable highlighting
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    highlightingEnabled: isEnabled
                });
            }
        });
    });
    
    document.getElementById('refreshStats').addEventListener('click', refreshStats);
});
