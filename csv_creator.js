// createTuneData.js

const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

/**
 * Function to shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} - Shuffled array
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        // Swap elements i and j
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Function to process exampleNews.json
 * @param {Array} newsData - Array of news objects
 * @returns {Array} - Array of processed entries with Sentence and Label
 */
function processNewsData(newsData) {
    const entries = [];

    newsData.forEach(item => {
        // Process Title
        if (item.title && item.title !== '[Removed]') {
            entries.push({
                Sentence: item.title.trim(),
                Label: 'News Title'
            });
        }

        // Process Description
        if (item.description && item.description !== '[Removed]') {
            entries.push({
                Sentence: item.description.trim(),
                Label: 'News Description'
            });
        }

        // Process Content
        if (item.content && item.content !== '[Removed]') {
            entries.push({
                Sentence: item.content.trim(),
                Label: 'News Article'
            });
        }
    });

    return entries;
}

/**
 * Function to process exampleRandom.json
 * @param {Array} randomData - Array of random text objects
 * @returns {Array} - Array of processed entries with Sentence and Label
 */
function processRandomData(randomData) {
    const entries = [];

    randomData.forEach(item => {
        if (item.text && item.text !== '[Removed]') {
            entries.push({
                Sentence: item.text.trim(),
                Label: 'Random'
            });
        }
    });

    return entries;
}

async function main() {
    try {
        const newsFilePath = path.join(__dirname, 'exampleNews.json');
        const randomFilePath = path.join(__dirname, 'exampleRandom.json');
        const outputCsvPath = path.join(__dirname, 'tuneData.csv');

        // Read and parse exampleNews.json
        const newsDataRaw = fs.readFileSync(newsFilePath, 'utf-8');
        const newsData = JSON.parse(newsDataRaw);

        // Read and parse exampleRandom.json
        const randomDataRaw = fs.readFileSync(randomFilePath, 'utf-8');
        const randomData = JSON.parse(randomDataRaw);

        // Process data
        let allEntries = [];
        allEntries = allEntries.concat(processNewsData(newsData));
        allEntries = allEntries.concat(processRandomData(randomData));

        // Shuffle entries
        allEntries = shuffleArray(allEntries);

        // Setup CSV Writer
        const csvWriter = createCsvWriter({
            path: outputCsvPath,
            header: [
                { id: 'Sentence', title: 'Sentence' },
                { id: 'Label', title: 'Label' }
            ]
        });

        // Write to CSV
        await csvWriter.writeRecords(allEntries);
        console.log(`CSV file created successfully at ${outputCsvPath}`);
    } catch (error) {
        console.error('An error occurred:', error.message);
    }
}

main();
