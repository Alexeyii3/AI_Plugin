// webpack.config.js

const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');

require('dotenv').config(); // Load environment variables from .env

module.exports = {
    mode: 'production', // or 'development'
    entry: {
        background: './src/background.js',
        contentScript: './src/contentScript.js',
        popup: './src/popup.js',  // Ensure popup.js is bundled
        'utils/tfConfig': './src/utils/tfConfig.js',
        'utils/tfWasmConfig': './src/utils/tfWasmConfig.js',
        'aiAnalyzerInit': './src/aiAnalyzerInit.js',
        'utils/tfCustomBundle': './src/utils/tfCustomBundle.js', // Added entry for tfCustomBundle
        'tokenizer-cache': './src/tokenizer-cache.js', // New entry for tokenizer-cache
        'sessionStorageUtil': './src/sessionStorageUtil.js' // New entry for sessionStorage
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js'
    },
    resolve: {
        extensions: ['.js', '.json']
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                WHOISXML_API_KEY: JSON.stringify(process.env.WHOISXML_API_KEY)
            }
        }),
        new CopyWebpackPlugin({
            patterns: [
                { from: 'src/manifest.json', to: 'manifest.json' },
                { from: 'src/popup.html', to: 'popup.html' },
                { from: 'src/styles.css', to: 'styles.css' },
                { from: 'src/popup.css', to: 'popup.css' },
                { from: 'src/newsDomains.json', to: 'newsDomains.json' },
                { from: 'src/tokenizer-cache.js', to: 'tokenizer-cache.js' }, // Copy new file
                { from: 'icons', to: 'icons' },
                { from: 'models', to: 'models' }
            ]
        })
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'] // If you're using CSS
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.json$/,
                type: 'javascript/auto',
                use: 'json-loader'
            }
        ]
    }
};
