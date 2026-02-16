const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => ({
  entry: {
    background: "./src/background/index.ts",
    "content/interests": "./src/content/interests.ts",
    "content/place": "./src/content/place.ts",
    "popup/index": "./src/popup/index.tsx",
    "options/index": "./src/options/index.ts",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true,
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      react: "preact/compat",
      "react-dom": "preact/compat",
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "manifest.json" },
        { from: "src/popup/index.html", to: "popup/index.html" },
        { from: "src/options/index.html", to: "options/index.html" },
      ],
    }),
  ],
  devtool: argv.mode === "development" ? "inline-source-map" : false,
});
