// Metro (the app's bundler): Expo's defaults, plus .tflite files as assets so the face model ships inside the app.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('tflite');

module.exports = config;
