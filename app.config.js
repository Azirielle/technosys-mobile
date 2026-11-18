// app.config.js: on EAS Build, google-services.json (git-ignored) comes from the EAS file variable GOOGLE_SERVICES_JSON.
// Everything else stays in app.json; on this computer the local file is used.
module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile },
});
