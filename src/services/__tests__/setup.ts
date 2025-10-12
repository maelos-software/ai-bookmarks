/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Jest test setup file
 * Suppress console.error and console.warn during tests to prevent
 * expected error logs from causing CI failures
 */

// Store original console methods
const originalError = console.error;
const originalWarn = console.warn;

// Suppress console.error and console.warn globally
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

// Restore original console methods after all tests
afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
