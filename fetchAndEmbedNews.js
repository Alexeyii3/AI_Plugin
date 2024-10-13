// fetchAndEmbedNews.js

require('dotenv').config(); // Load environment variables from .env
const axios = require('axios');
const fs = require('fs');
// const tf = require('@tensorflow/tfjs-node');
// const use = require('@tensorflow-models/universal-sentence-encoder');

// Configuration
const NEWSAPI_KEY = process.env.NEWSAPI_KEY;
const NEWSAPI_ENDPOINT = 'https://newsapi.org/v2/top-headlines';
const COUNTRY = 'us'; // You can change this to your preferred country
const PAGE_SIZE = 100; // Max articles per request (as per NewsAPI)
const TOTAL_ARTICLES = 100; // Total number of articles to fetch
const OUTPUT_JSON = 'exampleNews1.json';
const OUTPUT_EMBEDDINGS = 'exampleNewsEmbeddings.json';

// Validate API Key
if (!NEWSAPI_KEY) {
    console.error('Error: NEWSAPI_KEY is not set. Please set it in the .env file.');
    process.exit(1);
}

// Function to fetch news articles
async function fetchNews(page) {
    try {
        const response = await axios.get(NEWSAPI_ENDPOINT, {
            params: {
                apiKey: NEWSAPI_KEY,
                country: COUNTRY,
                pageSize: PAGE_SIZE,
                page: page
            }
        });

        if (response.data.status !== 'ok') {
            console.error(`Error fetching news: ${response.data.message}`);
            return [];
        }

        return response.data.articles.map(article => ({
            title: article.title || '',
            description: article.description || '',
            content: article.content || ''
        }));
    } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        return [];
    }
}

// Function to fetch all required news articles
async function fetchAllNews() {
    const totalPages = Math.ceil(TOTAL_ARTICLES / PAGE_SIZE);
    let allArticles = [];

    for (let page = 1; page <= totalPages; page++) {
        console.log(`Fetching page ${page} of ${totalPages}...`);
        const articles = await fetchNews(page);
        allArticles = allArticles.concat(articles);

        // Respect NewsAPI rate limits
        await sleep(1000); // Sleep for 1 second between requests
    }

    // Trim to the exact number of required articles
    return allArticles.slice(0, TOTAL_ARTICLES);
}

// Utility function to pause execution for a given time (milliseconds)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Function to save data to a JSON file
function saveJSON(data, filename) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Data saved to ${filename}`);
}

// Function to generate and save embeddings
// async function generateAndSaveEmbeddings(newsData) {
//     // Load the USE model
//     console.log('Loading Universal Sentence Encoder model...');
//     const model = await use.load();
//     console.log('USE model loaded.');
//
//     // Prepare texts for embedding (titles and content)
//     const texts = newsData.map(article => article.title + ' ' + article.content).filter(text => text.length > 0);
//
//     console.log('Generating embeddings for texts...');
//     const embeddingsTensor = await model.embed(texts);
//     const embeddings = embeddingsTensor.arraySync();
//     embeddingsTensor.dispose(); // Free up memory
//
//     // Combine the original data with embeddings
//     const newsWithEmbeddings = newsData.map((article, index) => ({
//         title: article.title,
//         content: article.content,
//         embedding: embeddings[index]
//     }));
//
//     // Save embeddings to JSON
//     saveJSON(newsWithEmbeddings, OUTPUT_EMBEDDINGS);
// }

// Main execution function
(async () => {
    console.log('Starting news fetching and embedding process...');

    // Step 1: Fetch news articles
    const newsData = await fetchAllNews();
    console.log(`Fetched ${newsData.length} articles.`);

    // Step 2: Save fetched news to JSON
    saveJSON(newsData, OUTPUT_JSON);

    // Step 3: Generate and save embeddings
    // await generateAndSaveEmbeddings(newsData);

    console.log('Process completed successfully.');
})();
