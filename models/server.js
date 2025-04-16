const express = require('express');
const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { registerCustomClasses } = require('./model_utils');

// Register custom classes for model loading
registerCustomClasses();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/tfjs_clickbait_model', express.static('tfjs_clickbait_model'));

// Load tokenizer and model
let tokenizer;
let model;

// Function to load the tokenizer from word_index.json and tokenizer_config.json
async function loadTokenizer() {
    try {
        // Determine base directory (model or tfjs_clickbait_model)
        let baseDir = 'model';
        if (!fs.existsSync(path.join(__dirname, baseDir, 'word_index.json'))) {
            baseDir = 'tfjs_clickbait_model';
        }

        // Load word_index.json
        const wordIndexPath = path.join(__dirname, baseDir, 'word_index.json');
        if (!fs.existsSync(wordIndexPath)) {
            throw new Error(`word_index.json not found at: ${wordIndexPath}`);
        }

        // Load tokenizer_config.json
        const configPath = path.join(__dirname, baseDir, 'tokenizer_config.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`tokenizer_config.json not found at: ${configPath}`);
        }

        console.log(`Loading tokenizer from ${baseDir} directory`);
        const wordIndex = JSON.parse(fs.readFileSync(wordIndexPath, 'utf8'));
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

        // Create a unified tokenizer object
        tokenizer = {
            word_index: wordIndex,
            oov_token: config.oov_token || '<UNK>',
            max_len: config.max_len || 30,
            vocab_size: config.vocab_size || 10000
        };

        // Verify the word_index is properly formed
        const wordCount = Object.keys(tokenizer.word_index).length;
        console.log(`✅ Loaded word_index with ${wordCount} entries`);
        console.log(`✅ Max sequence length: ${tokenizer.max_len}`);

        // Get OOV token index
        const oovIndex = tokenizer.word_index[tokenizer.oov_token];
        if (!oovIndex) {
            console.warn(`⚠️ OOV token '${tokenizer.oov_token}' not found in word_index`);
        } else {
            console.log(`✅ OOV token '${tokenizer.oov_token}' has index ${oovIndex}`);
        }

        // Test tokenization of common words
        const commonWords = ['the', 'a', 'and', 'is', 'of'];
        console.log('Testing common words:');
        commonWords.forEach(word => {
            const index = tokenizer.word_index[word] || oovIndex;
            console.log(`  "${word}" → ${index}${index === oovIndex ? ' (OOV)' : ''}`);
        });

        return true;
    } catch (error) {
        console.error('❌ Error loading tokenizer:', error);
        throw error;
    }
}

// Function to load the model
async function loadModel() {
    try {
        // Check if model files exist
        const modelJsonPath = path.join(__dirname, 'tfjs_clickbait_model', 'model.json');
        if (!fs.existsSync(modelJsonPath)) {
            throw new Error(`Model file not found at: ${modelJsonPath}`);
        }

        console.log(`Loading model from: ${modelJsonPath}`);
        // Use custom loading to handle regularizers properly
        model = await tf.loadLayersModel('file://./tfjs_clickbait_model/model.json', {
            strict: false  // More lenient loading to handle unknown attributes
        });
        console.log('✅ Model loaded successfully');

        // Log model architecture summary
        console.log('Model input shape:', model.inputs[0].shape);
        console.log('Model output shape:', model.outputs[0].shape);

        return true;
    } catch (error) {
        console.error('❌ Error loading model:', error);
        throw error;
    }
}

// Clean text (same logic as the Python function)
function cleanText(text) {
    return text.toLowerCase()
        .replace(/<[^>]+>/g, '')  // Remove HTML tags
        .replace(/[^\w\s]/g, ' ')  // Remove punctuation
        .replace(/\s+/g, ' ').trim();  // Normalize whitespace
}

// Text to sequence conversion using the word_index
function textToSequence(text, maxLen) {
    const cleaned = cleanText(text);
    const words = cleaned.split(' ');

    // Get OOV index
    const oovIndex = tokenizer.word_index[tokenizer.oov_token] || 1;

    // Convert words to token IDs
    const sequence = words.map(word => {
        const index = tokenizer.word_index[word] || oovIndex;
        return index;
    });

    // Log tokenization details for debugging
    console.log(`Tokenizing: "${text}"`);
    console.log(`Cleaned: "${cleaned}"`);
    console.log(`First few tokens: [${sequence.slice(0, 5).join(', ')}${sequence.length > 5 ? '...' : ''}]`);

    // Pad or truncate sequence to maxLen
    if (sequence.length > maxLen) {
        return sequence.slice(0, maxLen);
    } else {
        return [...sequence, ...Array(maxLen - sequence.length).fill(0)];
    }
}

// API endpoint for predictions
app.post('/api/predict', async (req, res) => {
    try {
        const { headline } = req.body;
        if (!headline) {
            return res.status(400).json({ error: 'Missing headline in request' });
        }

        // Convert headline to sequence
        const sequence = textToSequence(headline, tokenizer.max_len);

        // Make prediction
        const inputTensor = tf.tensor2d([sequence], [1, tokenizer.max_len]);
        const prediction = model.predict(inputTensor);
        const probability = await prediction.data();

        // Return result
        res.json({
            headline,
            probability: probability[0],
            isClickbait: probability[0] > 0.5
        });

    } catch (error) {
        console.error('Error making prediction:', error);
        res.status(500).json({ error: 'Error processing request: ' + error.message });
    }
});

// Test endpoint for tokenization only (useful for debugging)
app.post('/api/tokenize', (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Missing text in request' });
        }

        const sequence = textToSequence(text, tokenizer.max_len);

        res.json({
            original: text,
            cleaned: cleanText(text),
            sequence: sequence,
            length: sequence.length
        });
    } catch (error) {
        console.error('Error tokenizing text:', error);
        res.status(500).json({ error: 'Error tokenizing: ' + error.message });
    }
});

// Status endpoint
app.get('/api/status', (req, res) => {
    const tokenizer_loaded = tokenizer ? true : false;
    const model_loaded = model ? true : false;

    res.json({
        status: 'Server is running',
        tokenizer_loaded,
        model_loaded,
        max_sequence_length: tokenizer?.max_len || 'unknown'
    });
});

// Initialize and start server
async function startServer() {
    try {
        // Create public directory if it doesn't exist
        const publicDir = path.join(__dirname, 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir);
            console.log('Created public directory');
        }

        await loadTokenizer();
        await loadModel();

        app.listen(PORT, () => {
            console.log(`✅ Server running at http://localhost:${PORT}`);
            console.log(`💬 Test server status: curl http://localhost:${PORT}/api/status`);
            console.log(`💬 Test tokenization: curl -X POST http://localhost:${PORT}/api/tokenize -H "Content-Type: application/json" -d '{"text":"This is a test"}'`);
            console.log(`💬 Test prediction: curl -X POST http://localhost:${PORT}/api/predict -H "Content-Type: application/json" -d '{"headline":"You won't believe what happened next!"}'`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
    }
}

// Create a simple HTML test page
const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clickbait Detector</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #333; }
        textarea { width: 100%; height: 80px; padding: 10px; margin: 10px 0; }
        button { padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer; }
        .result { margin-top: 20px; padding: 15px; border-radius: 4px; display: none; }
        .clickbait { background-color: #ffcccc; }
        .not-clickbait { background-color: #ccffcc; }
    </style>
</head>
<body>
    <h1>Clickbait Headline Detector</h1>
    <p>Type or paste a headline below to check if it's clickbait.</p>
    
    <div>
        <textarea id="headline-input" placeholder="Enter a headline to analyze..."></textarea>
        <button onclick="analyzeHeadline()">Analyze</button>
    </div>
    
    <div id="result" class="result"></div>
    
    <div style="margin-top: 30px;">
        <h3>Examples to try:</h3>
        <ul>
            <li onclick="useExample(this)" style="cursor:pointer">Scientists discover new planet in Alpha Centauri system</li>
            <li onclick="useExample(this)" style="cursor:pointer">You won't believe what this celebrity did next!</li>
            <li onclick="useExample(this)" style="cursor:pointer">Study shows link between exercise and longevity</li>
            <li onclick="useExample(this)" style="cursor:pointer">This one weird trick will save you thousands on car insurance</li>
        </ul>
    </div>
    
    <script>
        function useExample(element) {
            document.getElementById('headline-input').value = element.textContent;
            analyzeHeadline();
        }
        
        async function analyzeHeadline() {
            const headline = document.getElementById('headline-input').value.trim();
            if (!headline) {
                alert('Please enter a headline to analyze.');
                return;
            }
            
            // Show loading 
            const resultDiv = document.getElementById('result');
            resultDiv.style.display = 'block';
            resultDiv.className = 'result';
            resultDiv.innerHTML = 'Analyzing...';
            
            try {
                const response = await fetch('/api/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ headline })
                });
                
                if (!response.ok) {
                    throw new Error('Server error');
                }
                
                const result = await response.json();
                const probabilityPercent = (result.probability * 100).toFixed(2);
                
                resultDiv.className = result.isClickbait ? 'result clickbait' : 'result not-clickbait';
                resultDiv.innerHTML = \`
                    <h3>Analysis Result</h3>
                    <p><strong>Headline:</strong> \${headline}</p>
                    <p><strong>Clickbait Probability:</strong> \${probabilityPercent}%</p>
                    <p><strong>Classification:</strong> \${result.isClickbait ? 'CLICKBAIT' : 'NOT CLICKBAIT'}</p>
                \`;
            } catch (error) {
                resultDiv.className = 'result';
                resultDiv.innerHTML = \`<p>Error: \${error.message || 'Failed to analyze headline'}</p>\`;
            }
        }
    </script>
</body>
</html>
`;

// Create the HTML file on startup
fs.writeFile(path.join(__dirname, 'public', 'index.html'), htmlContent, (err) => {
    if (err) {
        console.error('Error creating index.html:', err);
    } else {
        console.log('Created test page at public/index.html');
    }
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Handle all routes by serving the index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

startServer();