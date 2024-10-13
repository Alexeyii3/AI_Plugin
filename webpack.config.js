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
        analyzer: './src/analyzer.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].bundle.js'
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
                { from: 'models', to: 'models' },
                { from: 'icons', to: 'icons' }
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
            }
        ]
    }
};
