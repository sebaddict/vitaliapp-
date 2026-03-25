const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Polyfills para módulos de Node.js usados por dependencias de Supabase
// NO incluye net/tls porque el cliente Supabase usa WebSocket nativo de RN
config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
  zlib: require.resolve('browserify-zlib'),
  events: require.resolve('events'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  path: require.resolve('path-browserify'),
  buffer: require.resolve('buffer'),
};

module.exports = config;
