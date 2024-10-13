

const tf = require('@tensorflow/tfjs-node');
const use = require('@tensorflow-models/universal-sentence-encoder');
const fs = require('fs/promises');
const path = require('path');
/**
 * Function to compute cosine similarity between two vectors
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Cosine similarity score
 */
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

/**
 * Main function to embed texts and categorize them
 */
async function embedTexts() {
    try {
        // Load JSON data
        const newsDataPath = path.join(process.cwd(), 'exampleNews.json');
        const randomDataPath = path.join(process.cwd(), 'exampleRandom.json');

        const [newsDataRaw, randomDataRaw] = await Promise.all([
            fs.readFile(newsDataPath, 'utf-8'),
            fs.readFile(randomDataPath, 'utf-8')
        ]);

        const newsData = JSON.parse(newsDataRaw);
        const randomData = JSON.parse(randomDataRaw);

        // Load the Universal Sentence Encoder model
        console.log('Loading the Universal Sentence Encoder model...');
        const useModel = await use.load();
        console.log('Model loaded successfully.');

        // Prepare arrays for each category
        const categories = {
            'news_title': [],
            'news_description': [],
            'news_article': [],
            'random_text': []
        };

        // Extract and categorize texts from newsData
        newsData.forEach(item => {
            if (item.title && item.title.trim().length > 0) {
                categories['news_title'].push(item.title.trim());
            }
            if (item.description && item.description.trim().length > 0) {
                categories['news_description'].push(item.description.trim());
            }
            if (item.content && item.content.trim().length > 0) {
                categories['news_article'].push(item.content.trim());
            }
        });

        // Extract and categorize texts from randomData
        randomData.forEach(item => {
            if (item.text && item.text.trim().length > 0) {
                categories['random_text'].push(item.text.trim());
            }
        });

        // Function to embed texts for a specific category
        const embedCategoryTexts = async (categoryName, texts) => {
            console.log(`Embedding texts for category: ${categoryName} (${texts.length} items)`);
            const embeddings = await useModel.embed(texts);
            const embeddingsArray = await embeddings.array();
            embeddings.dispose(); // Clean up memory
            return embeddingsArray;
        };

        // Embed texts for all categories
        const embeddedCategories = {};

        for (const [categoryName, texts] of Object.entries(categories)) {
            if (texts.length === 0) {
                embeddedCategories[categoryName] = [];
                continue;
            }
            const embeddings = await embedCategoryTexts(categoryName, texts);
            embeddedCategories[categoryName] = embeddings;
        }

        // Combine embedded data into a single object
        const combinedEmbeddedData = {
            'news_title': categories['news_title'].map((text, idx) => ({
                'text': text,
                'embedding': embeddedCategories['news_title'][idx]
            })),
            'news_description': categories['news_description'].map((text, idx) => ({
                'text': text,
                'embedding': embeddedCategories['news_description'][idx]
            })),
            'news_article': categories['news_article'].map((text, idx) => ({
                'text': text,
                'embedding': embeddedCategories['news_article'][idx]
            })),
            'random_text': categories['random_text'].map((text, idx) => ({
                'text': text,
                'embedding': embeddedCategories['random_text'][idx]
            }))
        };

        // Save the embedded data to a new JSON file
        const outputPath = path.join(process.cwd(), 'embeddedData.json');
        await fs.writeFile(outputPath, JSON.stringify(combinedEmbeddedData, null, 2));
        console.log(`Embedded data saved to ${outputPath}`);

        // Optionally, compute and log similarity scores for demonstration
        // For example, compute similarity between a sample text and each category

        const sampleText = "Breaking news: Major event unfolds in the city center";
        const sampleEmbedding = await useModel.embed([sampleText]);
        const sampleEmbeddingArray = sampleEmbedding.arraySync()[0];
        sampleEmbedding.dispose();

        const similarities = {};

        for (const categoryName in combinedEmbeddedData) {
            similarities[categoryName] = combinedEmbeddedData[categoryName].map(item => ({
                'text': item.text,
                'similarity': cosineSimilarity(sampleEmbeddingArray, item.embedding)
            }));
        }

        console.log('Similarity scores for sample text:', similarities);

    } catch (error) {
        console.error('Error during embedding process:', error);
    }
}

// Execute the embedding process
embedTexts();
