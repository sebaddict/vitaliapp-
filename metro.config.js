const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];

config.resolver.extraNodeModules = {
  stream: require.resolve('stream-browserify'),
  zlib: require.resolve('browserify-zlib'),
  events: require.resolve('events'),
  http: require.resolve('stream-http'),
  https: require.resolve('https-browserify'),
  path: require.resolve('path-browserify'),
  buffer: require.resolve('buffer'),
  url: require.resolve('react-native-url-polyfill'),
  // net y tls — shims en el repo (requieren path relativo al proyecto)
  net: require.resolve('./shims/net.js'),
  tls: require.resolve('./shims/tls.js'),
};

module.exports = config;
