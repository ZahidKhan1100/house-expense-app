const { withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

/**
 * Android 9+ blocks plain HTTP unless the app opts in. Local dev APIs (http://192.168.x.x)
 * fail silently for fetch() unless this is set. Use HTTPS in production; remove this plugin
 * or switch to a network security config if you do not need LAN HTTP.
 */
function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, async (modConfig) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      modConfig.modResults,
    );
    mainApplication.$ = mainApplication.$ ?? {};
    mainApplication.$["android:usesCleartextTraffic"] = "true";
    return modConfig;
  });
}

module.exports = withAndroidCleartextTraffic;
