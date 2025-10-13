/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Centralized logging system with configurable verbosity
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.TRACE; // Default to most verbose
  private enableConsole: boolean = true;
  private logs: Array<{
    timestamp: string;
    level: string;
    component: string;
    message: string;
    data?: unknown;
  }> = [];
  private maxLogs: number = 1000;

  private constructor() {
    // Load settings from storage
    this.loadSettings();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['logLevel', 'enableConsole']);
      if (result.logLevel !== undefined) {
        this.logLevel = result.logLevel;
      }
      if (result.enableConsole !== undefined) {
        this.enableConsole = result.enableConsole;
      }
    } catch (err) {
      // Ignore errors loading settings
    }
  }

  setLogLevel(level: number) {
    this.logLevel = level as LogLevel;
  }

  setConsoleLogging(enabled: boolean) {
    this.enableConsole = enabled;
  }

  async saveLogLevel(level: LogLevel) {
    this.logLevel = level;
    await chrome.storage.local.set({ logLevel: level });
  }

  async saveConsoleEnabled(enabled: boolean) {
    this.enableConsole = enabled;
    await chrome.storage.local.set({ enableConsole: enabled });
  }

  private log(
    level: LogLevel,
    levelName: string,
    component: string,
    message: string,
    data?: unknown
  ) {
    if (level > this.logLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: levelName,
      component,
      message,
      data,
    };

    // Store in memory
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output
    if (this.enableConsole) {
      const prefix = `[${timestamp}] [${levelName}] [${component}]`;
      const consoleMethod =
        level === LogLevel.ERROR
          ? console.error
          : level === LogLevel.WARN
            ? console.warn
            : console.log;

      if (data !== undefined) {
        consoleMethod(prefix, message, data);
      } else {
        consoleMethod(prefix, message);
      }
    }
  }

  error(component: string, message: string, data?: unknown) {
    this.log(LogLevel.ERROR, 'ERROR', component, message, data);
  }

  warn(component: string, message: string, data?: unknown) {
    this.log(LogLevel.WARN, 'WARN', component, message, data);
  }

  info(component: string, message: string, data?: unknown) {
    this.log(LogLevel.INFO, 'INFO', component, message, data);
  }

  debug(component: string, message: string, data?: unknown) {
    this.log(LogLevel.DEBUG, 'DEBUG', component, message, data);
  }

  trace(component: string, message: string, data?: unknown) {
    this.log(LogLevel.TRACE, 'TRACE', component, message, data);
  }

  getLogs(): Array<{
    timestamp: string;
    level: string;
    component: string;
    message: string;
    data?: unknown;
  }> {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Singleton instance
export const logger = Logger.getInstance();
