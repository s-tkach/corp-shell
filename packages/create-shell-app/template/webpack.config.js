const { ModuleFederationPlugin } = require("webpack").container;
const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/index.ts",
  output: {
    filename: "remoteEntry.js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "auto",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: "{{APP_CAMEL_NAME}}",
      filename: "remoteEntry.js",
      exposes: {
        "./AppEntry": "./src/AppEntry",
      },
      shared: {
        react: { singleton: true, eager: false },
        "react-dom": { singleton: true, eager: false },
        "@corp/shell-sdk": { singleton: true, eager: false },
      },
    }),
  ],
};
