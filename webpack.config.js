const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Alias react-native-svg to react-native-svg-web for web
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    'react-native-svg$': 'react-native-svg-web',
  };

  return config;
};