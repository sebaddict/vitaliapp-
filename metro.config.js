// metro.config.js - Fix para @supabase/realtime-js en React Native
// Resuelve el error: "Unable to resolve module 'stream'"
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');

// Mapear módulos de Node.js a alternativas compatibles con React Native
config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
};

module.exports = config;
