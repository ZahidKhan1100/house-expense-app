module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for your curved tab bar animations
      'react-native-reanimated/plugin',
      
    ],
  };
};