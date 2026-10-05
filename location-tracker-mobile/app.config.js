const config = require("./app.json");

config.expo.version = "1.2.2";

// Use the existing Location Tracker artwork as the launcher icon.
// Do not generate or reference a missing PNG at build time.
const icon = "./assets/location-tracker-icon.svg";

config.expo.icon = icon;
config.expo.android = config.expo.android || {};
config.expo.android.icon = icon;
config.expo.android.adaptiveIcon = {
  backgroundColor: "#062b55",
  foregroundImage: icon
};

module.exports = config;
