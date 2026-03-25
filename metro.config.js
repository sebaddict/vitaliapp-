// metro.config.js
// Fix oficial para @supabase/supabase-js + Expo SDK 53
// Fuente: https://github.com/supabase/supabase-js/issues/1400
// Expo SDK 53 activó unstable_enablePackageExports por defecto en RN 0.79
// Esto hace que Metro cargue la versión Node.js de 'ws' de @supabase/realtime-js
// Solución: desactivarlo para que Metro use resolución clásica (browser-compatible)

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// FIX: Desactiva package.json exports para usar resolución clásica
// Esto fuerza a @supabase/realtime-js a usar WebSocket nativo de RN
// en lugar de 'ws' (que requiere módulos Node.js: stream, zlib, net, tls)
config.resolver.unstable_enablePackageExports = false;
config.resolver.unstable_conditionNames = ['browser'];

module.exports = config;
