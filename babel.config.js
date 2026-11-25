module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        // Sency SDK key. Copy AuthKey.local.properties.example to AuthKey.local.properties
        // (git-ignored) and set SMKIT_UI_AUTH_KEY. A SMKIT_UI_AUTH_KEY environment variable
        // overrides the file (useful for CI). Same setup as smkit-ui-android-demo.
        path: 'AuthKey.local.properties',
        safe: false,
        allowlist: ['SMKIT_UI_AUTH_KEY'],
      },
    ],
  ],
};
