// index.js

import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to allow all origins
app.use(cors({
    origin: '*', // Allows all origins
    methods: ['POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Apply rate limiting to all requests
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Middleware to parse JSON bodies
app.use(express.json());

// POST /analyze endpoint
// POST /analyze endpoint
app.post('/analyze', async (req, res) => {
    const { texts } = req.body; // Expecting { texts: [ "text1", "text2", ... ] }

    if (!texts || !Array.isArray(texts)) {
        return res.status(400).json({ error: 'Invalid input format. Expecting an array of texts.' });
    }

    const apiKey = process.env.AZURE_API_KEY;
    const deploymentId = process.env.DEPLOYMENT_ID;
    const endpointUrl = process.env.ENDPOINT_URL;

    const requestBody = { inputs: texts };

    try {
        const response = await axios.post(endpointUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'azureml-model-deployment': deploymentId,
            },
        });

        // Wrap the raw array in an object with a 'predictions' key
        res.json({ predictions: response.data });
    } catch (error) {
        console.error('Error calling Azure ML endpoint:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to analyze texts.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
