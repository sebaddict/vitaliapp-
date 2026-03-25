// Shim vacío para 'tls' en React Native
// @supabase/realtime-js usa WebSocket nativo de RN, no necesita tls
module.exports = {
  connect: () => ({}),
  createServer: () => ({}),
  TLSSocket: function() {},
};

// Shim vacío para 'net' en React Native
// @supabase/realtime-js usa WebSocket nativo de RN, no necesita net
module.exports = {
  createConnection: () => ({}),
  Socket: function() {},
  connect: () => ({}),
  isIP: () => 0,
  isIPv4: () => false,
  isIPv6: () => false,
};
