// contentScript.js

// Import TensorFlow.js and the Universal Sentence Encoder
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

// Variable to track if highlighting is enabled
let highlightingEnabled = true;

// Load the Universal Sentence Encoder model
let useModel;
use.load().then(model => {
    useModel = model;
    console.log('Universal Sentence Encoder model loaded.');
    // Once the model is loaded, process the page
    processPage();
}).catch(error => {
    console.error('Error loading USE model:', error);
});

/**
 * Checks if the current site is a news site.
 * @param {function} callback - Callback function to handle the response.
 */
function isNewsSite(callback) {
    const currentUrl = window.location.href;

    // Send a message to the background script to check the domain
    chrome.runtime.sendMessage(
        { action: 'checkNewsSite', url: currentUrl },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error sending message:', chrome.runtime.lastError);
                callback(false);
            } else {
                const isNewsSite = response.isNewsSite;
                callback(isNewsSite);
            }
        }
    );
}

// Main function to process the page
function processPage() {
    if (!highlightingEnabled) {
        return;
    }

    isNewsSite((isNews) => {
        if (isNews) {
            // Proceed with content analysis
            processPageContent();
        } else {
            console.log("Non-news site detected. Skipping content analysis.");
        }
    });
}

// Function to remove highlights
function removeHighlights() {
    const highlightedElements = document.querySelectorAll('.ai-plugin-highlight');
    highlightedElements.forEach((element) => {
        element.style.backgroundColor = '';
        element.style.cursor = '';
        element.title = '';
        element.classList.remove('ai-plugin-highlight');
    });
}

// Function to highlight elements
function highlightElement(element) {
    element.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
    element.style.cursor = 'pointer';
    element.title = 'This content may be unverified or misleading.';
    element.classList.add('ai-plugin-highlight');
}

// Representative texts for each category
const categoryTexts = {
    'title': [
        'Breaking news: Major event unfolds',
        'Exclusive: Insider reveals details',
        'Alert: Important update on situation'
    ],
    'article': [
        'The recent developments have led to...',
        'In an unprecedented move, officials have decided to...',
        'According to reports, the situation is evolving rapidly...'
    ],
    'random': [
        'Read more about this topic',
        'Click here to subscribe',
        'Share this article with friends'
    ]
};

// Variable to store category embeddings
let categoryEmbeddings = {};

// Function to compute embeddings for representative texts
async function computeCategoryEmbeddings() {
    for (const category in categoryTexts) {
        const texts = categoryTexts[category];
        const embeddings = await useModel.embed(texts);
        categoryEmbeddings[category] = embeddings.arraySync();
    }
}

// Function to classify text based on similarity
async function classifyText(text) {
    if (!useModel || Object.keys(categoryEmbeddings).length === 0) {
        console.error('Model or category embeddings not loaded yet.');
        return 'random';
    }

    // Compute embedding for the input text
    const textEmbedding = await useModel.embed([text]);
    const textEmbeddingArray = textEmbedding.arraySync()[0];

    let highestSimilarity = -1;
    let assignedCategory = 'random';

    // Compute cosine similarity with each category
    for (const category in categoryEmbeddings) {
        const embeddings = categoryEmbeddings[category];
        for (const categoryEmbedding of embeddings) {
            const similarity = cosineSimilarity(textEmbeddingArray, categoryEmbedding);
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                assignedCategory = category;
            }
        }
    }

    // Dispose tensors
    textEmbedding.dispose();

    return assignedCategory;
}

// Function to compute cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Function to detect unverified claims
function detectUnverifiedClaim(text) {
    const claimKeywords = [
        'according to',
        'reportedly',
        'unverified',
        'allegedly',
        'claims that',
        'states that',
        'says that',
        'suggests',
        'argues',
        'asserts',
        'maintains'
    ];
    return claimKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

// Main function to process the page content
async function processPageContent() {
    if (!highlightingEnabled) return;

    // Compute category embeddings if not already done
    if (Object.keys(categoryEmbeddings).length === 0) {
        await computeCategoryEmbeddings();
    }

    // Select all relevant elements
    const elements = document.querySelectorAll('p, div, span, h1, h2, h3, h4, section, article');

    for (let element of elements) {
        const text = element.innerText.trim();

        if (text.length < 20) continue; // Skip very short texts

        const category = await classifyText(text);

        if (category === 'title' || category === 'article') {
            // Perform further analysis (e.g., claim detection)
            const isUnverified = detectUnverifiedClaim(text);
            if (isUnverified) {
                highlightElement(element);
            }
        }
    }
}

// Listen for messages from the popup (for toggling highlighting)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.highlightingEnabled !== undefined) {
        highlightingEnabled = request.highlightingEnabled;
        if (highlightingEnabled) {
            processPage();
        } else {
            removeHighlights();
        }
    }
});

// Run the main function when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', processPage);
} else {
    processPage();
}
