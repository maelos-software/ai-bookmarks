module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  env: {
    browser: true,
    es6: true,
    node: true,
    webextensions: true
  },
  rules: {
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'off', // Console logging is acceptable in Chrome extensions for debugging
    '@typescript-eslint/no-unused-vars': ['warn', {
      'argsIgnorePattern': '^_',
      'varsIgnorePattern': '^_'
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn'
  },
  ignorePatterns: ['dist/', 'node_modules/', 'coverage/', '*.config.js', 'build-release-zip.sh'],
  overrides: [
    {
      // Relax rules in test files for mocking purposes
      files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ]
};