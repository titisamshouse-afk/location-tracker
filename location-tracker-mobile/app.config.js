const config = require("./app.json");

config.expo.version = "2.1.0";
// Android and iOS both use the existing Location Tracker PNG.
config.expo.icon = "./location-tracker-icon.png";
if (config.expo.android) {
  delete config.expo.android.icon;
  delete config.expo.android.adaptiveIcon;
}

module.exports = config;
