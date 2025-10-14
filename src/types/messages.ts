/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Type definitions for chrome.runtime messages
 */

import type { AppConfig } from '../services/ConfigurationManager.js';
import type { BookmarkTreeNode } from '../services/BookmarkManager.js';

// Message types
export type MessageType =
  | 'GENERATE_PREVIEW'
  | 'EXECUTE_REORGANIZATION'
  | 'EXECUTE_SELECTIVE_REORGANIZATION'
  | 'GET_FOLDER_TREE'
  | 'GET_REORGANIZATION_STATUS'
  | 'CHECK_CONFIG'
  | 'GET_CONFIG'
  | 'UPDATE_CONFIG'
  | 'SAVE_CONFIG'
  | 'TEST_CONNECTION'
  | 'UPDATE_LOGGER_CONFIG'
  | 'GET_SYSTEM_FOLDERS'
  | 'CLEAR_ORGANIZATION_HISTORY'
  | 'MARK_ALL_ORGANIZED'
  | 'PING';

// Base message interface
interface BaseMessage {
  type: MessageType;
}

// Specific message types
export interface GeneratePreviewMessage extends BaseMessage {
  type: 'GENERATE_PREVIEW';
}

export interface ExecuteReorganizationMessage extends BaseMessage {
  type: 'EXECUTE_REORGANIZATION';
}

export interface ExecuteSelectiveReorganizationMessage extends BaseMessage {
  type: 'EXECUTE_SELECTIVE_REORGANIZATION';
  folderIds: string[];
}

export interface GetFolderTreeMessage extends BaseMessage {
  type: 'GET_FOLDER_TREE';
}

export interface GetReorganizationStatusMessage extends BaseMessage {
  type: 'GET_REORGANIZATION_STATUS';
}

export interface CheckConfigMessage extends BaseMessage {
  type: 'CHECK_CONFIG';
}

export interface GetConfigMessage extends BaseMessage {
  type: 'GET_CONFIG';
}

export interface UpdateConfigMessage extends BaseMessage {
  type: 'UPDATE_CONFIG';
  config: AppConfig;
}

export interface SaveConfigMessage extends BaseMessage {
  type: 'SAVE_CONFIG';
  config: AppConfig;
}

export interface TestConnectionMessage extends BaseMessage {
  type: 'TEST_CONNECTION';
  config?: AppConfig;
}

export interface UpdateLoggerConfigMessage extends BaseMessage {
  type: 'UPDATE_LOGGER_CONFIG';
  config: {
    logLevel: number;
    consoleLogging: boolean;
  };
}

export interface GetSystemFoldersMessage extends BaseMessage {
  type: 'GET_SYSTEM_FOLDERS';
}

export interface ClearOrganizationHistoryMessage extends BaseMessage {
  type: 'CLEAR_ORGANIZATION_HISTORY';
}

export interface MarkAllOrganizedMessage extends BaseMessage {
  type: 'MARK_ALL_ORGANIZED';
}

export interface PingMessage extends BaseMessage {
  type: 'PING';
}

// Union type of all messages
export type RuntimeMessage =
  | GeneratePreviewMessage
  | ExecuteReorganizationMessage
  | ExecuteSelectiveReorganizationMessage
  | GetFolderTreeMessage
  | GetReorganizationStatusMessage
  | CheckConfigMessage
  | GetConfigMessage
  | UpdateConfigMessage
  | SaveConfigMessage
  | TestConnectionMessage
  | UpdateLoggerConfigMessage
  | GetSystemFoldersMessage
  | ClearOrganizationHistoryMessage
  | MarkAllOrganizedMessage
  | PingMessage;

// Response types
export interface SuccessResponse<T = unknown> {
  success: true;
  data?: T;
  config?: AppConfig;
  tree?: BookmarkTreeNode[];
  result?: ReorganizationResult;
  [key: string]: unknown;
}

export interface ErrorResponse {
  success: false;
  error: string;
}

export type MessageResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

// Reorganization result
export interface ReorganizationResult {
  bookmarksMoved: number;
  foldersCreated: number;
  duplicatesRemoved: number;
  emptyFoldersRemoved: number;
  bookmarksSkipped: number;
  errors: string[];
  timestamp: number;
  organizationMode?: 'create' | 'existing';
}

// Reorganization progress
export interface ReorganizationProgress {
  current: number;
  total: number;
  message: string;
}

export interface ReorganizationStatusResponse {
  isReorganizing: boolean;
  progress: ReorganizationProgress | null;
}
