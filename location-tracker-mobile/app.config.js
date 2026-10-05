const config = require("./app.json");

config.expo.version = "1.2.2";

// Use the existing Location Tracker artwork as the launcher icon.
// Use the real PNG asset already stored in this repository.
const icon = "./assets/location-tracker-icon.png";

config.expo.icon = icon;
config.expo.android = config.expo.android || {};
config.expo.android.icon = icon;
config.expo.android.adaptiveIcon = {
  backgroundColor: "#062b55",
  foregroundImage: icon
};

module.exports = config;
