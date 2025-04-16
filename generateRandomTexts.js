// generateRandomTexts.js

const fs = require('fs');
const { faker } = require('@faker-js/faker');

// Number of random texts to generate
const NUM_RANDOM_TEXTS = 200;

// Function to generate realistic random texts
function generateRealisticTexts(num) {
    const randomTexts = [];
    for (let i = 0; i < num; i++) {
        // Generate random but realistic titles and content
        const title = `${faker.company.catchPhrase()}`;
        const content = `${faker.hacker.phrase()} ${faker.lorem.paragraph()}`;

        randomTexts.push({
            title: title,
            content: content
        });
    }
    return randomTexts;
}

// Generate the random texts
const randomTexts = generateRealisticTexts(NUM_RANDOM_TEXTS);

// Save to exampleRandom.json
fs.writeFileSync('exampleRandom.json', JSON.stringify(randomTexts, null, 2), 'utf-8');
console.log(`Generated and saved ${NUM_RANDOM_TEXTS} random realistic texts to exampleRandom.json`);
