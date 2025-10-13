/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Jest test setup file
 * Suppress console.error and console.warn during tests to prevent
 * expected error logs from causing CI failures
 * Sets up Chrome API mocking for extension testing
 */

// Set up Chrome API mocking
import 'jest-webextension-mock';

// Store original console methods
const originalError = console.error;
const originalWarn = console.warn;

// Extend jest-webextension-mock with additional Chrome APIs
beforeAll(() => {
  // Suppress console methods
  console.error = jest.fn();
  console.warn = jest.fn();

  // Add bookmarks API mock
  global.chrome.bookmarks = {
    create: jest.fn().mockResolvedValue({ id: 'test-id' }),
    get: jest.fn().mockResolvedValue([]),
    getChildren: jest.fn().mockResolvedValue([]),
    getTree: jest.fn().mockResolvedValue([]),
    move: jest.fn().mockResolvedValue({}),
    remove: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({}),
    onCreated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
    onMoved: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
      hasListener: jest.fn(),
    },
  } as unknown as typeof chrome.bookmarks;

  // Add action API mock (MV3)
  global.chrome.action = {
    setBadgeText: jest.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: jest.fn().mockResolvedValue(undefined),
    setTitle: jest.fn().mockResolvedValue(undefined),
    getBadgeText: jest.fn().mockResolvedValue(''),
    getBadgeBackgroundColor: jest.fn().mockResolvedValue([0, 0, 0, 0]),
    getTitle: jest.fn().mockResolvedValue(''),
  } as unknown as typeof chrome.action;
});

// Restore original console methods after all tests
afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
