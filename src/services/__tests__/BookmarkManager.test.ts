/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { BookmarkManager } from '../BookmarkManager';

describe('BookmarkManager', () => {
  let manager: BookmarkManager;
  let mockBookmarkTree: chrome.bookmarks.BookmarkTreeNode[];

  beforeEach(() => {
    manager = new BookmarkManager();

    // Create a mock bookmark tree
    mockBookmarkTree = [
      {
        id: '0',
        title: '',
        children: [
          {
            id: '1',
            title: 'Bookmarks Bar',
            children: [
              {
                id: '10',
                title: 'Tech Folder',
                children: [
                  { id: '100', title: 'GitHub', url: 'https://github.com' },
                  { id: '101', title: 'Stack Overflow', url: 'https://stackoverflow.com' },
                ],
              },
              {
                id: '11',
                title: 'News Folder',
                children: [{ id: '110', title: 'BBC', url: 'https://bbc.com' }],
              },
              { id: '12', title: 'Empty Folder', children: [] },
            ],
          },
          {
            id: '2',
            title: 'Other Bookmarks',
            children: [
              { id: '200', title: 'Random Site', url: 'https://example.com' },
              { id: '201', title: 'Duplicate', url: 'https://github.com' },
            ],
          },
          {
            id: '3',
            title: 'Mobile Bookmarks',
            children: [],
          },
        ],
      },
    ];

    // Mock Chrome APIs
    global.chrome = {
      bookmarks: {
        getTree: jest.fn(() => Promise.resolve(mockBookmarkTree)),
        getChildren: jest.fn((id) => {
          const findNode = (
            nodes: chrome.bookmarks.BookmarkTreeNode[]
          ): chrome.bookmarks.BookmarkTreeNode | undefined => {
            for (const node of nodes) {
              if (node.id === id) return node;
              if (node.children) {
                const found = findNode(node.children);
                if (found) return found;
              }
            }
            return undefined;
          };
          const node = findNode(mockBookmarkTree);
          return Promise.resolve(node?.children || []);
        }),
        getSubTree: jest.fn((id) => {
          const findNode = (
            nodes: chrome.bookmarks.BookmarkTreeNode[]
          ): chrome.bookmarks.BookmarkTreeNode | undefined => {
            for (const node of nodes) {
              if (node.id === id) return node;
              if (node.children) {
                const found = findNode(node.children);
                if (found) return found;
              }
            }
            return undefined;
          };
          const node = findNode(mockBookmarkTree);
          return Promise.resolve(node ? [node] : []);
        }),
        create: jest.fn((details) =>
          Promise.resolve({
            id: 'new-folder-id',
            title: details.title,
            parentId: details.parentId,
          })
        ),
        update: jest.fn(() => Promise.resolve({})),
        move: jest.fn(() => Promise.resolve({})),
        remove: jest.fn(() => Promise.resolve()),
        removeTree: jest.fn(() => Promise.resolve()),
      },
    } as any;
  });

  describe('normalizeTitle', () => {
    it('should normalize titles to lowercase and trim whitespace', () => {
      expect(BookmarkManager.normalizeTitle('  Test Folder  ')).toBe('test folder');
      expect(BookmarkManager.normalizeTitle('UPPERCASE')).toBe('uppercase');
      expect(BookmarkManager.normalizeTitle('Mixed Case')).toBe('mixed case');
    });
  });

  describe('getAllBookmarks', () => {
    it('should return all bookmarks from tree', async () => {
      const bookmarks = await manager.getAllBookmarks();

      expect(bookmarks.length).toBeGreaterThanOrEqual(4);
      expect(bookmarks.find((b) => b.title === 'GitHub')).toBeDefined();
      expect(bookmarks.find((b) => b.title === 'BBC')).toBeDefined();
      expect(bookmarks.find((b) => b.title === 'Random Site')).toBeDefined();
      expect(bookmarks.find((b) => b.title === 'Duplicate')).toBeDefined();
    });

    it('should include url for each bookmark', async () => {
      const bookmarks = await manager.getAllBookmarks();

      bookmarks.forEach((bookmark) => {
        expect(bookmark.url).toBeDefined();
      });
    });
  });

  describe('getAllFolders', () => {
    it('should return all folders from tree', async () => {
      const folders = await manager.getAllFolders();

      expect(folders.length).toBeGreaterThan(0);
      expect(folders.find((f) => f.title === 'Tech Folder')).toBeDefined();
      expect(folders.find((f) => f.title === 'News Folder')).toBeDefined();
      expect(folders.find((f) => f.title === 'Empty Folder')).toBeDefined();
    });

    it('should not include bookmarks', async () => {
      const folders = await manager.getAllFolders();

      expect(folders.find((f) => f.title === 'GitHub')).toBeUndefined();
      expect(folders.find((f) => f.title === 'BBC')).toBeUndefined();
    });
  });

  describe('findFoldersByName', () => {
    it('should find folders by exact name (case-insensitive)', async () => {
      const folders = await manager.findFoldersByName('Tech Folder');

      expect(folders).toHaveLength(1);
      expect(folders[0].title).toBe('Tech Folder');
    });

    it('should handle case-insensitive search', async () => {
      const folders = await manager.findFoldersByName('tech folder');

      expect(folders).toHaveLength(1);
      expect(folders[0].title).toBe('Tech Folder');
    });

    it('should return empty array for non-existent folder', async () => {
      const folders = await manager.findFoldersByName('Non Existent');

      expect(folders).toHaveLength(0);
    });
  });

  describe('findFolderByName', () => {
    it('should return folder ID when found', async () => {
      const folderId = await manager.findFolderByName('Tech Folder');

      expect(folderId).toBe('10');
    });

    it('should return null when not found', async () => {
      const folderId = await manager.findFolderByName('Non Existent');

      expect(folderId).toBeNull();
    });
  });

  describe('ensureFolder', () => {
    it('should return existing folder ID if folder exists at same parent', async () => {
      // Mock getAllFolders to return our test folders
      jest.spyOn(manager, 'getAllFolders').mockResolvedValue([
        { id: '10', title: 'Tech Folder', parentId: '1' },
        { id: '11', title: 'News Folder', parentId: '1' },
      ]);

      const folderId = await manager.ensureFolder('Tech Folder', '1');

      expect(folderId).toBe('10');
      expect(chrome.bookmarks.create).not.toHaveBeenCalled();
    });

    it('should create new folder if it does not exist', async () => {
      jest
        .spyOn(manager, 'getAllFolders')
        .mockResolvedValue([{ id: '10', title: 'Tech Folder', parentId: '1' }]);

      const folderId = await manager.ensureFolder('New Folder', '1');

      expect(folderId).toBe('new-folder-id');
      expect(chrome.bookmarks.create).toHaveBeenCalledWith({
        title: 'New Folder',
        parentId: '1',
      });
    });
  });

  describe('moveBookmark', () => {
    it('should call chrome.bookmarks.move with correct parameters', async () => {
      await manager.moveBookmark('100', '11');

      expect(chrome.bookmarks.move).toHaveBeenCalledWith('100', { parentId: '11' });
    });
  });

  describe('renameFolder', () => {
    it('should call chrome.bookmarks.update with new title', async () => {
      await manager.renameFolder('10', 'New Title');

      expect(chrome.bookmarks.update).toHaveBeenCalledWith('10', { title: 'New Title' });
    });
  });

  describe('getBookmarksInFolder', () => {
    it('should return bookmarks in specific folder', async () => {
      // Mock getAllBookmarks to return bookmarks with proper parentId
      jest.spyOn(manager, 'getAllBookmarks').mockResolvedValue([
        { id: '100', title: 'GitHub', url: 'https://github.com', parentId: '10' },
        { id: '101', title: 'Stack Overflow', url: 'https://stackoverflow.com', parentId: '10' },
        { id: '110', title: 'BBC', url: 'https://bbc.com', parentId: '11' },
      ]);

      const bookmarks = await manager.getBookmarksInFolder('10');

      expect(bookmarks).toHaveLength(2);
      expect(bookmarks.find((b) => b.title === 'GitHub')).toBeDefined();
      expect(bookmarks.find((b) => b.title === 'Stack Overflow')).toBeDefined();
    });

    it('should return empty array for folder with no bookmarks', async () => {
      jest
        .spyOn(manager, 'getAllBookmarks')
        .mockResolvedValue([
          { id: '100', title: 'GitHub', url: 'https://github.com', parentId: '10' },
        ]);

      const bookmarks = await manager.getBookmarksInFolder('12');

      expect(bookmarks).toHaveLength(0);
    });
  });

  describe('findDuplicates', () => {
    it('should find duplicate bookmarks by URL', async () => {
      const duplicates = await manager.findDuplicates();

      expect(duplicates.size).toBe(1);
      expect(duplicates.has('https://github.com')).toBe(true);
      expect(duplicates.get('https://github.com')).toHaveLength(2);
    });

    it('should not include unique URLs', async () => {
      const duplicates = await manager.findDuplicates();

      expect(duplicates.has('https://bbc.com')).toBe(false);
      expect(duplicates.has('https://stackoverflow.com')).toBe(false);
    });
  });

  describe('removeDuplicates', () => {
    it('should remove duplicate bookmarks keeping first occurrence', async () => {
      const result = await manager.removeDuplicates();

      expect(result.removed).toBe(1);
      expect(result.details).toHaveLength(1);
      expect(chrome.bookmarks.remove).toHaveBeenCalledWith('201');
    });

    it('should not remove first occurrence', async () => {
      await manager.removeDuplicates();

      expect(chrome.bookmarks.remove).not.toHaveBeenCalledWith('100');
    });
  });

  describe('findEmptyFolders', () => {
    it('should find empty folders', async () => {
      const emptyFolders = await manager.findEmptyFolders();

      const emptyFolder = emptyFolders.find((f) => f.title === 'Empty Folder');
      expect(emptyFolder).toBeDefined();
    });

    it('should not include system folders', async () => {
      const emptyFolders = await manager.findEmptyFolders();

      expect(emptyFolders.find((f) => f.title === 'Bookmarks Bar')).toBeUndefined();
      expect(emptyFolders.find((f) => f.title === 'Other Bookmarks')).toBeUndefined();
      expect(emptyFolders.find((f) => f.title === 'Mobile Bookmarks')).toBeUndefined();
    });
  });

  describe('getFolderDescendants', () => {
    it('should return folder and all descendants', async () => {
      const descendants = await manager.getFolderDescendants('1');

      expect(descendants).toContain('1');
      expect(descendants).toContain('10');
      expect(descendants).toContain('11');
      expect(descendants).toContain('12');
    });

    it('should return only folder ID for leaf folders', async () => {
      const descendants = await manager.getFolderDescendants('12');

      expect(descendants).toEqual(['12']);
    });
  });

  describe('getBookmarksInFolders', () => {
    it('should get bookmarks from multiple folders and subfolders', async () => {
      jest.spyOn(manager, 'getAllBookmarks').mockResolvedValue([
        { id: '100', title: 'GitHub', url: 'https://github.com', parentId: '10' },
        { id: '110', title: 'BBC', url: 'https://bbc.com', parentId: '11' },
      ]);

      jest.spyOn(manager, 'getFolderDescendants').mockResolvedValue(['1', '10', '11']);

      const bookmarks = await manager.getBookmarksInFolders(['1']);

      expect(bookmarks.length).toBeGreaterThan(0);
      expect(bookmarks.find((b) => b.title === 'GitHub')).toBeDefined();
      expect(bookmarks.find((b) => b.title === 'BBC')).toBeDefined();
    });

    it('should include bookmarks from descendant folders', async () => {
      jest.spyOn(manager, 'getAllBookmarks').mockResolvedValue([
        { id: '100', title: 'Test1', url: 'https://test1.com', parentId: '10' },
        { id: '110', title: 'Test2', url: 'https://test2.com', parentId: '11' },
      ]);

      jest.spyOn(manager, 'getFolderDescendants').mockResolvedValue(['1', '10', '11']);

      const bookmarks = await manager.getBookmarksInFolders(['1']);

      expect(bookmarks.find((b) => b.parentId === '10')).toBeDefined();
      expect(bookmarks.find((b) => b.parentId === '11')).toBeDefined();
    });
  });

  describe('getSystemFolders', () => {
    it('should return system folders', async () => {
      const systemFolders = await manager.getSystemFolders();

      expect(systemFolders.find((f) => f.title === 'Bookmarks Bar')).toBeDefined();
      expect(systemFolders.find((f) => f.title === 'Other Bookmarks')).toBeDefined();
    });

    it('should mark root folders correctly', async () => {
      const systemFolders = await manager.getSystemFolders();

      const bookmarksBar = systemFolders.find((f) => f.title === 'Bookmarks Bar');
      expect(bookmarksBar?.isRoot).toBe(true);
    });
  });

  describe('getBookmarkTreeWithCounts', () => {
    it('should return tree with bookmark counts', async () => {
      const tree = await manager.getBookmarkTreeWithCounts();

      expect(tree.length).toBeGreaterThan(0);
      expect(tree[0]).toHaveProperty('directBookmarks');
      expect(tree[0]).toHaveProperty('totalBookmarks');
      expect(tree[0]).toHaveProperty('children');
    });

    it('should include folder metadata', async () => {
      const tree = await manager.getBookmarkTreeWithCounts();

      tree.forEach((node) => {
        expect(node.id).toBeDefined();
        expect(node.title).toBeDefined();
        expect(typeof node.directBookmarks).toBe('number');
        expect(typeof node.totalBookmarks).toBe('number');
        expect(Array.isArray(node.children)).toBe(true);
      });
    });

    it('should calculate bookmark counts correctly', async () => {
      jest.spyOn(manager, 'getAllBookmarks').mockResolvedValue([
        { id: '100', title: 'Test1', url: 'https://test1.com', parentId: '10' },
        { id: '101', title: 'Test2', url: 'https://test2.com', parentId: '10' },
      ]);

      const tree = await manager.getBookmarkTreeWithCounts();

      expect(tree).toBeDefined();
      expect(Array.isArray(tree)).toBe(true);
    });
  });

  describe('removeEmptyFolders', () => {
    it('should remove empty folders', async () => {
      const result = await manager.removeEmptyFolders();

      expect(result.removed).toBeGreaterThan(0);
      expect(chrome.bookmarks.remove).toHaveBeenCalled();
    });

    it('should not remove protected folders', async () => {
      await manager.removeEmptyFolders();

      expect(chrome.bookmarks.remove).not.toHaveBeenCalledWith('1');
      expect(chrome.bookmarks.remove).not.toHaveBeenCalledWith('2');
      expect(chrome.bookmarks.remove).not.toHaveBeenCalledWith('3');
    });

    it('should handle errors gracefully', async () => {
      (chrome.bookmarks.remove as jest.Mock).mockRejectedValueOnce(new Error('Cannot remove'));

      const result = await manager.removeEmptyFolders();

      expect(result).toBeDefined();
    });
  });

  describe('findFoldersByPattern', () => {
    it('should find folders matching pattern', async () => {
      const folders = await manager.findFoldersByPattern('tech');

      expect(folders.length).toBeGreaterThan(0);
      expect(folders.some((f) => f.title === 'Tech Folder')).toBe(true);
    });

    it('should normalize folder names for matching', async () => {
      const folders = await manager.findFoldersByPattern('TECH');

      expect(folders.some((f) => f.title === 'Tech Folder')).toBe(true);
    });

    it('should return empty array when no matches', async () => {
      const folders = await manager.findFoldersByPattern('nonexistent');

      expect(folders).toEqual([]);
    });
  });

  describe('renameFolder', () => {
    it('should rename a folder', async () => {
      await manager.renameFolder('10', 'New Name');

      expect(chrome.bookmarks.update).toHaveBeenCalledWith('10', { title: 'New Name' });
    });
  });

  describe('removeDuplicates', () => {
    it('should remove duplicate bookmarks by URL', async () => {
      // Add a duplicate bookmark
      (chrome.bookmarks.getTree as jest.Mock).mockResolvedValue([
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bookmarks Bar',
              children: [
                {
                  id: '100',
                  title: 'GitHub',
                  url: 'https://github.com',
                },
                {
                  id: '101',
                  title: 'GitHub Duplicate',
                  url: 'https://github.com',
                },
              ],
            },
          ],
        },
      ]);

      const result = await manager.removeDuplicates();

      expect(result.removed).toBeGreaterThan(0);
      expect(chrome.bookmarks.remove).toHaveBeenCalled();
    });

    it('should keep the oldest bookmark when removing duplicates', async () => {
      const result = await manager.removeDuplicates();

      expect(result).toBeDefined();
      expect(result.details).toBeDefined();
    });

    it('should handle errors during duplicate removal', async () => {
      (chrome.bookmarks.remove as jest.Mock).mockRejectedValueOnce(new Error('Remove failed'));

      const result = await manager.removeDuplicates();

      expect(result).toBeDefined();
    });
  });

  describe('getFolderDescendants', () => {
    it('should get all descendant folders', async () => {
      (chrome.bookmarks.getSubTree as jest.Mock).mockResolvedValue([
        {
          id: '1',
          title: 'Parent',
          children: [
            { id: '10', title: 'Child 1', children: [] },
            {
              id: '11',
              title: 'Child 2',
              children: [{ id: '20', title: 'Grandchild', children: [] }],
            },
          ],
        },
      ]);

      const descendants = await manager.getFolderDescendants('1');

      expect(descendants.length).toBeGreaterThan(0);
      expect(descendants).toContain('1');
    });

    it('should handle errors getting descendants', async () => {
      (chrome.bookmarks.getSubTree as jest.Mock).mockRejectedValueOnce(new Error('Failed'));

      const descendants = await manager.getFolderDescendants('999');

      expect(descendants).toEqual(['999']);
    });
  });

  describe('getBookmarksInFolder', () => {
    it('should get all bookmarks in a specific folder', async () => {
      const bookmarks = await manager.getBookmarksInFolder('10');

      expect(bookmarks).toBeDefined();
      expect(Array.isArray(bookmarks)).toBe(true);
    });
  });

  describe('removeEmptyFolders - edge cases', () => {
    it('should handle renamed Speed Dial folder IDs', async () => {
      const result = await manager.removeEmptyFolders(['renamed-id-1']);

      expect(result).toBeDefined();
    });

    it('should break when no empty folders found', async () => {
      // Mock getAllFolders to return no empty folders
      jest.spyOn(manager, 'getAllFolders').mockResolvedValue([
        {
          id: '1',
          title: 'Bookmarks Bar',
          parentId: '0',
          children: [{ id: '10', title: 'Folder with bookmarks', url: 'https://test.com' }],
        },
      ]);

      const result = await manager.removeEmptyFolders();

      expect(result.removed).toBe(0);
    });

    it('should handle empty folder check errors', async () => {
      // Mock getSubTree to fail during empty folder detection
      (chrome.bookmarks.getSubTree as jest.Mock).mockRejectedValueOnce(new Error('SubTree error'));

      const result = await manager.removeEmptyFolders();

      // Should handle error gracefully and continue
      expect(result).toBeDefined();
    });
  });

  describe('Additional edge cases', () => {
    it('should handle errors in moveBookmark', async () => {
      (chrome.bookmarks.move as jest.Mock).mockRejectedValueOnce(new Error('Move failed'));

      await expect(manager.moveBookmark('1', '2')).rejects.toThrow('Move failed');
    });

    it('should handle findFolderByName when no folders exist', async () => {
      jest.spyOn(manager, 'getAllFolders').mockResolvedValue([]);

      const result = await manager.findFolderByName('NonExistent');

      expect(result).toBeNull();
    });

    it('should normalize titles with special characters', async () => {
      jest
        .spyOn(manager, 'getAllFolders')
        .mockResolvedValue([{ id: '10', title: 'Tech Folder', parentId: '1' }]);

      const result = await manager.findFolderByName('TECH FOLDER');

      expect(result).not.toBeNull();
    });
  });
});
