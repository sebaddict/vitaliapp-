// metro.config.js — Fix definitivo para @supabase/supabase-js en React Native
// El problema: @supabase/realtime-js usa 'ws' (Node.js) que requiere net, tls, etc.
// La solución: mapear ws al WebSocket nativo de React Native + shims para net/tls

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Archivos .cjs (CommonJS) de módulos modernos
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

// Mapear módulos Node.js que NO existen en React Native
config.resolver.extraNodeModules = {
  // Módulos de stream/compresión
  stream: require.resolve('stream-browserify'),
  zlib: require.resolve('browserify-zlib'),
  // Módulos de red — shims vacíos (RN usa WebSocket nativo)
  net: path.resolve(__dirname, 'shims/net.js'),
  tls: path.resolve(__dirname, 'shims/tls.js'),
  // Módulos HTTP
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  // Módulos utilitarios
  path: require.resolve('path-browserify'),
  buffer: require.resolve('buffer'),
  crypto: require.resolve('react-native-get-random-values'),
  events: require.resolve('events'),
};

module.exports = config;
