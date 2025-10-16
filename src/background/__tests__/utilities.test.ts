/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { matchGlobPattern } from '../utilities.js';

describe('matchGlobPattern', () => {
  describe('exact matching (no wildcards)', () => {
    it('should match exact strings', () => {
      expect(matchGlobPattern('Documents', 'Documents')).toBe(true);
      expect(matchGlobPattern('Work', 'Work')).toBe(true);
      expect(matchGlobPattern('Photos', 'Photos')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(matchGlobPattern('Documents', 'documents')).toBe(true);
      expect(matchGlobPattern('WORK', 'work')).toBe(true);
      expect(matchGlobPattern('pHoToS', 'PhOtOs')).toBe(true);
    });

    it('should trim whitespace', () => {
      expect(matchGlobPattern('  Documents  ', 'Documents')).toBe(true);
      expect(matchGlobPattern('Work', '  Work  ')).toBe(true);
      expect(matchGlobPattern('  Photos  ', '  Photos  ')).toBe(true);
    });

    it('should not match different strings', () => {
      expect(matchGlobPattern('Documents', 'Work')).toBe(false);
      expect(matchGlobPattern('Photos', 'Videos')).toBe(false);
    });
  });

  describe('* wildcard (matches any characters)', () => {
    it('should match with * at the end', () => {
      expect(matchGlobPattern('Old Documents', 'old*')).toBe(true);
      expect(matchGlobPattern('Archive 2023', 'archive*')).toBe(true);
      expect(matchGlobPattern('Temp Files', 'temp*')).toBe(true);
    });

    it('should match with * at the beginning', () => {
      expect(matchGlobPattern('Old Documents', '*documents')).toBe(true);
      expect(matchGlobPattern('2023 Archive', '*archive')).toBe(true);
      expect(matchGlobPattern('My Files', '*files')).toBe(true);
    });

    it('should match with * in the middle', () => {
      expect(matchGlobPattern('Old Documents', 'old*ments')).toBe(true);
      expect(matchGlobPattern('Archive 2023', 'archive*23')).toBe(true);
      expect(matchGlobPattern('Temp Work Files', 'temp*files')).toBe(true);
    });

    it('should match with multiple *', () => {
      expect(matchGlobPattern('Old Work Documents', 'old*work*')).toBe(true);
      expect(matchGlobPattern('Archive 2023 Files', '*2023*')).toBe(true);
      expect(matchGlobPattern('My Old Stuff', 'my*old*')).toBe(true);
    });

    it('should match * as entire pattern (matches everything)', () => {
      expect(matchGlobPattern('Any Text Here', '*')).toBe(true);
      expect(matchGlobPattern('Documents', '*')).toBe(true);
      expect(matchGlobPattern('', '*')).toBe(true);
    });

    it('should not match when * pattern does not fit', () => {
      expect(matchGlobPattern('Documents', 'work*')).toBe(false);
      expect(matchGlobPattern('Photos', '*videos')).toBe(false);
      expect(matchGlobPattern('Archive', 'temp*files')).toBe(false);
    });
  });

  describe('? wildcard (matches single character)', () => {
    it('should match single character with ?', () => {
      expect(matchGlobPattern('Archive 2023', 'archive 202?')).toBe(true);
      expect(matchGlobPattern('File1', 'file?')).toBe(true);
      expect(matchGlobPattern('WorkA', 'work?')).toBe(true);
    });

    it('should match multiple ? wildcards', () => {
      expect(matchGlobPattern('Archive 2023', 'archive ????')).toBe(true);
      expect(matchGlobPattern('File123', 'file???')).toBe(true);
      expect(matchGlobPattern('AB', '??')).toBe(true);
    });

    it('should not match when ? count does not match', () => {
      expect(matchGlobPattern('Archive 2023', 'archive 20?')).toBe(false); // 3 chars but only 1 ?
      expect(matchGlobPattern('File12', 'file???')).toBe(false); // 2 chars but 3 ?
      expect(matchGlobPattern('A', '??')).toBe(false); // 1 char but 2 ?
    });
  });

  describe('combined wildcards (* and ?)', () => {
    it('should match patterns with both * and ?', () => {
      expect(matchGlobPattern('Old Archive 2023', 'old*202?')).toBe(true);
      expect(matchGlobPattern('Temp File 1', 'temp*?')).toBe(true);
      expect(matchGlobPattern('Work Document A', 'work*?')).toBe(true);
    });

    it('should handle complex patterns', () => {
      expect(matchGlobPattern('My Old Documents 2023', 'my*doc*202?')).toBe(true);
      expect(matchGlobPattern('Archive File ABC', '*file*??')).toBe(true);
      expect(matchGlobPattern('Temp Work 123', 'temp*?23')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      expect(matchGlobPattern('', '')).toBe(true);
      expect(matchGlobPattern('', '*')).toBe(true);
      expect(matchGlobPattern('Text', '')).toBe(false);
    });

    it('should handle patterns with only wildcards', () => {
      expect(matchGlobPattern('Any Text', '***')).toBe(true);
      expect(matchGlobPattern('ABC', '???')).toBe(true);
    });

    it('should handle special regex characters in folder names', () => {
      expect(matchGlobPattern('My (Work) Documents', 'my (work) documents')).toBe(true);
      expect(matchGlobPattern('Files [2023]', 'files [2023]')).toBe(true);
      expect(matchGlobPattern('Project $$$', 'project $$$')).toBe(true);
      expect(matchGlobPattern('Docs + Notes', 'docs + notes')).toBe(true);
    });

    it('should handle special regex characters in patterns', () => {
      expect(matchGlobPattern('Project (ABC)', 'project (abc)')).toBe(true);
      expect(matchGlobPattern('Files [123]', 'files [*]')).toBe(true);
      expect(matchGlobPattern('My.Files', 'my.files')).toBe(true);
    });

    it('should not partially match', () => {
      expect(matchGlobPattern('Documents', 'doc')).toBe(false);
      expect(matchGlobPattern('Archive', 'arch')).toBe(false);
      expect(matchGlobPattern('Work Files', 'work')).toBe(false);
    });

    it('should require full string match with anchoring', () => {
      expect(matchGlobPattern('My Documents Folder', 'documents')).toBe(false);
      expect(matchGlobPattern('Old Archive Files', 'archive')).toBe(false);
      expect(matchGlobPattern('Temp Work Data', 'work')).toBe(false);
    });
  });

  describe('real-world folder patterns', () => {
    it('should match common archive patterns', () => {
      expect(matchGlobPattern('Old Stuff', 'old*')).toBe(true);
      expect(matchGlobPattern('Archive 2022', 'archive*')).toBe(true);
      expect(matchGlobPattern('Backup Files', 'backup*')).toBe(true);
      expect(matchGlobPattern('Deleted Items', '*deleted*')).toBe(true);
    });

    it('should match common temp patterns', () => {
      expect(matchGlobPattern('Temp', 'temp*')).toBe(true);
      expect(matchGlobPattern('Temporary Files', 'temp*')).toBe(true);
      expect(matchGlobPattern('TMP', 'tmp*')).toBe(true);
    });

    it('should match year-based patterns', () => {
      expect(matchGlobPattern('Archive 2020', '*2020*')).toBe(true);
      expect(matchGlobPattern('Docs 2021', '*2021*')).toBe(true);
      expect(matchGlobPattern('Photos 2022', '*2022*')).toBe(true);
      expect(matchGlobPattern('2023 Projects', '202?*')).toBe(true);
    });

    it('should not match unrelated patterns', () => {
      expect(matchGlobPattern('Important Work', 'old*')).toBe(false);
      expect(matchGlobPattern('Active Projects', 'archive*')).toBe(false);
      expect(matchGlobPattern('Current Files', 'temp*')).toBe(false);
    });
  });
});
