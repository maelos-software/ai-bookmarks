const path = require('path');

module.exports = {
  entry: {
    background: './src/background/background.ts',
    popup: './src/popup/popup.ts',
    options: './src/options/options.ts',
    results: './src/results/results.ts',
    'folder-selector': './src/folder-selector/folder-selector.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    extensionAlias: {
      '.js': ['.js', '.ts']
    }
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  optimization: {
    splitChunks: false,
  },
};