// metro.config.js
// Expo SDK 54 / RN 0.81 enables Metro's package.json "exports" resolution by
// default, which breaks the Firebase JS SDK (v10) module resolution. Disabling
// it restores the pre-SDK-53 behavior Firebase expects.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;

module.exports = config;
