/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * Utility functions for background service
 */

/**
 * Match a folder name against a glob-style pattern
 * Supports * (any characters) and ? (single character)
 *
 * @param folderName - The folder name to match
 * @param pattern - The glob pattern (supports * and ? wildcards)
 * @returns true if the folder name matches the pattern
 *
 * @example
 * matchGlobPattern("Work", "work") // true (case-insensitive)
 * matchGlobPattern("Old Stuff", "old*") // true
 * matchGlobPattern("Archive 2023", "archive ????") // true
 * matchGlobPattern("Documents", "doc*") // true
 */
export function matchGlobPattern(folderName: string, pattern: string): boolean {
  // Normalize both strings to lowercase for case-insensitive matching
  const name = folderName.toLowerCase().trim();
  const pat = pattern.toLowerCase().trim();

  // If pattern has no wildcards, do exact match
  if (!pat.includes('*') && !pat.includes('?')) {
    return name === pat;
  }

  // Convert glob pattern to regex
  // Escape special regex characters except * and ?
  let regexPattern = pat.replace(/[.+^${}()|[\]\\]/g, '\\$&');

  // Replace glob wildcards with regex equivalents
  regexPattern = regexPattern.replace(/\*/g, '.*').replace(/\?/g, '.');

  // Anchor the pattern to match the entire string
  regexPattern = `^${regexPattern}$`;

  const regex = new RegExp(regexPattern);
  return regex.test(name);
}
