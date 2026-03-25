// metro.config.js
// Fix definitivo para @supabase/supabase-js en React Native / Expo
// Mapea módulos de Node.js a alternativas compatibles con React Native
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Necesario para importar archivos .cjs de librerías modernas
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Mapear módulos de Node.js a polyfills de React Native
// @supabase/realtime-js depende de 'ws' que a su vez necesita estos módulos
config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
  zlib: require.resolve('browserify-zlib'),
  events: require.resolve('events'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  path: require.resolve('path-browserify'),
  buffer: require.resolve('buffer'),
  crypto: require.resolve('crypto-browserify'),
  url: require.resolve('react-native-url-polyfill'),
};

module.exports = config;
