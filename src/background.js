// src/background.js

import psl from 'psl';
import newsDomains from './newsDomains.json';

// Define cache parameters
const cacheDuration = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const domainCache = {};

/**
 * Listen for messages from content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkNewsSite') {
        const url = message.url;
        checkIfNewsSiteCached(url)
            .then((isNewsSite) => {
                sendResponse({ isNewsSite });
            })
            .catch((error) => {
                console.error('Error checking news site:', error);
                sendResponse({ isNewsSite: false });
            });
        return true; // Indicates that sendResponse will be called asynchronously
    }
});

/**
 * Checks if a given URL belongs to a news site, utilizing caching, newsDomains.json, customNewsSites, and API fallback.
 * @param {string} url - The full URL of the website.
 * @returns {Promise<boolean>} - Resolves to true if it's a news site, else false.
 */
async function checkIfNewsSiteCached(url) {
    const now = Date.now();

    let hostname;
    try {
        const urlObj = new URL(url);
        hostname = urlObj.hostname;
    } catch (e) {
        console.error('Invalid URL format:', e);
        return false;
    }


    // Extract the base domain using psl
    const parsedDomain = psl.parse(hostname);
    const baseDomain = parsedDomain.domain;

    if (!baseDomain) {
        console.error('Unable to extract base domain.');
        return false;
    }

    // Check if the base domain is in the cache
    if (domainCache[baseDomain]) {
        const cachedEntry = domainCache[baseDomain];
        if (now - cachedEntry.timestamp < cacheDuration) {
            return cachedEntry.isNewsSite;
        }
    }

    // Retrieve custom news sites from storage
    const { customNewsSites } = await chrome.storage.sync.get(['customNewsSites']);

    // Combine default newsDomains with customNewsSites
    const allNewsDomains = newsDomains.concat(customNewsSites || []);

    // Check if the base domain is in the combined newsDomains list
    let isNewsSite = allNewsDomains.includes(baseDomain) || allNewsDomains.includes(hostname.replace("www.", '').replace("https://", "").replace("http://", ""));

    if (!isNewsSite) {
        // If not in the list, perform the API call to WhoisXML
        isNewsSite = await checkIfNewsSiteAPI(baseDomain);
        console.log('API check result:', isNewsSite);
        if (!isNewsSite && baseDomain !== hostname) {
            console.log('API check failed. Checking full hostname:', hostname);
            isNewsSite = await checkIfNewsSiteAPI(hostname);
        }
    }

    // Cache the result
    domainCache[baseDomain] = {
        isNewsSite,
        timestamp: now,
    };

    return isNewsSite;
}

/**
 * Checks if a given base domain is a news site using the WhoisXML API.
 * @param {string} baseDomain - The base domain to check.
 * @returns {Promise<boolean>} - Resolves to true if it's a news site, else false.
 */
async function checkIfNewsSiteAPI(baseDomain) {
    if (baseDomain.startsWith("www.")) {
        // Remove the "www." prefix
        baseDomain = baseDomain.slice(4);
    } else if (baseDomain.startsWith("http://")) {
        // Remove the "http://" prefix
        baseDomain = baseDomain.slice(7);
    } else if (baseDomain.startsWith("https://")) {
        // Remove the "https://" prefix
        baseDomain = baseDomain.slice(8);
    }
    const apiKey = "at_dsat4E7JfoImmwF6uWeYw5j4ABSvm"; // Replace with your actual API key
    const apiUrl = `https://website-categorization.whoisxmlapi.com/api/v3?apiKey=${apiKey}&url=${baseDomain}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        console.log("API response:", data);

        // Check if the domain is categorized under "News and Media"
        const categories = data.categories || [];
        const isNewsSite = categories.some((category) => {
            return category.name.toLowerCase().includes("news");
        });

        return isNewsSite;
    } catch (error) {
        console.error("API error:", error);
        return false; // Default to false in case of error
    }
}
