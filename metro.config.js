const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation loads a wa-sqlite.wasm file — Metro doesn't treat
// .wasm as a bundleable asset by default, which crashes the web bundle at import time
// (a Metro/expo-sqlite web-packaging gap, not an application bug). Native builds don't
// use this path at all (real SQLite, not the wasm worker), but the web preview is a
// useful verification tool for everything that isn't SQLite-specific, so keep it working.
config.resolver.assetExts.push('wasm');

module.exports = config;
