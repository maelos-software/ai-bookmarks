/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Logger, LogLevel } from '../Logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset singleton
    (Logger as any).instance = undefined;

    // Mock chrome storage
    global.chrome = {
      storage: {
        local: {
          get: jest.fn(() => Promise.resolve({})),
          set: jest.fn(() => Promise.resolve()),
        },
      },
    } as any;

    // Spy on console methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

    logger = Logger.getInstance();
    logger.clearLogs();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('log levels', () => {
    beforeEach(() => {
      logger.setLogLevel(LogLevel.INFO);
      logger.setConsoleLogging(false);
    });

    it('should log ERROR when level is INFO', () => {
      logger.error('TestComponent', 'Error message');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('ERROR');
    });

    it('should log WARN when level is INFO', () => {
      logger.warn('TestComponent', 'Warning message');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('WARN');
    });

    it('should log INFO when level is INFO', () => {
      logger.info('TestComponent', 'Info message');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('INFO');
    });

    it('should not log DEBUG when level is INFO', () => {
      logger.debug('TestComponent', 'Debug message');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });

    it('should not log TRACE when level is INFO', () => {
      logger.trace('TestComponent', 'Trace message');
      const logs = logger.getLogs();
      expect(logs).toHaveLength(0);
    });
  });

  describe('console logging', () => {
    beforeEach(() => {
      logger.setLogLevel(LogLevel.TRACE);
    });

    it('should output to console when enabled', () => {
      logger.setConsoleLogging(true);
      logger.error('TestComponent', 'Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not output to console when disabled', () => {
      logger.setConsoleLogging(false);
      logger.error('TestComponent', 'Error message');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should use console.error for ERROR level', () => {
      logger.setConsoleLogging(true);
      logger.error('TestComponent', 'Error message');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should use console.warn for WARN level', () => {
      logger.setConsoleLogging(true);
      logger.warn('TestComponent', 'Warning message');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should use console.log for INFO level', () => {
      logger.setConsoleLogging(true);
      logger.info('TestComponent', 'Info message');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('log storage', () => {
    beforeEach(() => {
      logger.setLogLevel(LogLevel.TRACE);
      logger.setConsoleLogging(false);
    });

    it('should store logs with correct structure', () => {
      logger.info('TestComponent', 'Test message', { extra: 'data' });
      const logs = logger.getLogs();

      expect(logs[0]).toMatchObject({
        level: 'INFO',
        component: 'TestComponent',
        message: 'Test message',
        data: { extra: 'data' },
      });
      expect(logs[0].timestamp).toBeDefined();
    });

    it('should limit log storage to maxLogs', () => {
      const maxLogs = 1000;

      // Log more than maxLogs
      for (let i = 0; i < maxLogs + 100; i++) {
        logger.info('TestComponent', `Message ${i}`);
      }

      const logs = logger.getLogs();
      expect(logs.length).toBe(maxLogs);
    });

    it('should clear logs', () => {
      logger.info('TestComponent', 'Message 1');
      logger.info('TestComponent', 'Message 2');
      expect(logger.getLogs()).toHaveLength(2);

      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });
  });

  describe('export logs', () => {
    beforeEach(() => {
      logger.setLogLevel(LogLevel.TRACE);
      logger.setConsoleLogging(false);
    });

    it('should export logs as JSON string', () => {
      logger.info('TestComponent', 'Test message');
      const exported = logger.exportLogs();

      expect(typeof exported).toBe('string');
      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed[0].message).toBe('Test message');
    });

    it('should export empty array when no logs', () => {
      logger.clearLogs();
      const exported = logger.exportLogs();
      const parsed = JSON.parse(exported);
      expect(parsed).toEqual([]);
    });
  });

  describe('persistence', () => {
    it('should save log level to storage', async () => {
      await logger.saveLogLevel(LogLevel.ERROR);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ logLevel: LogLevel.ERROR });
    });

    it('should save console enabled to storage', async () => {
      await logger.saveConsoleEnabled(false);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ enableConsole: false });
    });
  });
});
