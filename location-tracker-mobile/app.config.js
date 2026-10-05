const config = require("./app.json");

config.expo.version = "1.2.2";
const icon = "./location-tracker-icon.png";
config.expo.icon = icon;
config.expo.android = config.expo.android || {};
config.expo.android.icon = icon;
delete config.expo.android.adaptiveIcon;

module.exports = config;
