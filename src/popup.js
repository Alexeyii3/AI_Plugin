// src/popup.js

document.addEventListener('DOMContentLoaded', () => {
    const toggleHighlightingCheckbox = document.getElementById('toggle-highlighting');
    const customSiteInput = document.getElementById('custom-site-input');
    const addSiteButton = document.getElementById('add-site-button');
    const removeSiteButton = document.getElementById('remove-site-button');

    // Load the current highlighting setting from storage
    chrome.storage.sync.get(['highlightingEnabled'], (result) => {
        toggleHighlightingCheckbox.checked = result.highlightingEnabled !== false;
    });

    // Load custom news sites input
    addSiteButton.addEventListener('click', () => {
        const site = customSiteInput.value.trim().toLowerCase();
        if (site) {
            chrome.storage.sync.get(['customNewsSites'], (result) => {
                const updatedSites = result.customNewsSites ? [...result.customNewsSites] : [];
                if (!updatedSites.includes(site)) {
                    updatedSites.push(site);
                    chrome.storage.sync.set({ customNewsSites: updatedSites }, () => {
                        alert(`${site} has been added to custom news sites.`);
                        customSiteInput.value = '';
                    });
                } else {
                    alert(`${site} is already in the custom news sites list.`);
                }
            });
        }
    });

    removeSiteButton.addEventListener('click', () => {
        const site = customSiteInput.value.trim().toLowerCase();
        if (site) {
            chrome.storage.sync.get(['customNewsSites'], (result) => {
                let updatedSites = result.customNewsSites ? [...result.customNewsSites] : [];
                if (updatedSites.includes(site)) {
                    updatedSites = updatedSites.filter((s) => s !== site);
                    chrome.storage.sync.set({ customNewsSites: updatedSites }, () => {
                        alert(`${site} has been removed from custom news sites.`);
                        customSiteInput.value = '';
                    });
                } else {
                    alert(`${site} is not in the custom news sites list.`);
                }
            });
        }
    });

    // Toggle highlighting
    toggleHighlightingCheckbox.addEventListener('change', (event) => {
        const highlightingEnabled = event.target.checked;
        chrome.storage.sync.set({ highlightingEnabled }, () => {
            // Send a message to content scripts to enable/disable highlighting
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, { highlightingEnabled });
                }
            });
        });
    });
});
