module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
          safe: false,
          allowUndefined: false,
        },
      ],
      'react-native-worklets/plugin', // 👈 Must be LAST (Reanimated 4 moved the plugin here)
    ],
  };
};