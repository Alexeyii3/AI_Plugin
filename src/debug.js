/**
 * News Analyzer Extension Debug Helper
 * This script adds debugging capabilities for popup and background script communication
 */

// Debug logger that works across contexts
window.debugLog = function(context, message, data) {
    const timestamp = new Date().toISOString().substr(11, 8);
    console.log(`[${timestamp}][${context}] ${message}`, data || '');
    
    // Add to debug log in storage if enabled
    if (window.debugLoggingEnabled) {
        chrome.storage.local.get(['debugLog'], (result) => {
            const logs = result.debugLog || [];
            logs.push({
                timestamp: timestamp,
                context: context,
                message: message,
                data: data
            });
            
            // Keep only the last 100 logs
            if (logs.length > 100) {
                logs.shift();
            }
            
            chrome.storage.local.set({ debugLog: logs });
        });
    }
};

// Initialize debugging when this script is included
(function() {
    console.log('Debug helper loaded');
    
    // Listen for runtime errors
    window.addEventListener('error', (event) => {
        window.debugLog('ERROR', event.message, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });
    
    // Listen for unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        window.debugLog('PROMISE', 'Unhandled rejection', event.reason);
    });
    
    // Patch chrome.runtime.sendMessage to add logging
    const originalSendMessage = chrome.runtime.sendMessage;
    chrome.runtime.sendMessage = function(message, callback) {
        window.debugLog('SEND', 'Message sent', message);
        return originalSendMessage.call(chrome.runtime, message, (response) => {
            window.debugLog('RECV', 'Response received', response);
            if (callback) callback(response);
        });
    };
    
    // Enable debug logging
    window.debugLoggingEnabled = true;
    
    // Add emergency popup fix
    if (document.getElementById('currentSite') && 
        document.getElementById('currentSite').textContent === 'Loading...') {
        
        setTimeout(() => {
            const currentSite = document.getElementById('currentSite');
            const siteBadge = document.getElementById('siteBadge');
            
            if (currentSite && currentSite.textContent === 'Loading...') {
                currentSite.textContent = 'Emergency Fix Applied';
                window.debugLog('EMERGENCY', 'Fixed stuck loading state for currentSite');
            }
            
            if (siteBadge && siteBadge.textContent === 'Loading...') {
                siteBadge.textContent = 'Status Fixed';
                siteBadge.className = 'site-badge non-news';
                window.debugLog('EMERGENCY', 'Fixed stuck loading state for siteBadge');
            }
        }, 3000);
    }
})();
