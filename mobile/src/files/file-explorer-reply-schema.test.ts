import { describe, expect, it } from 'vitest'
import { fileDirectoryEntriesSchema, legacyFileListSchema } from './file-explorer-reply-schema'

describe('file explorer reply schemas', () => {
  it('requires the listing itself to be an array', () => {
    expect(fileDirectoryEntriesSchema.safeParse({ entries: [] }).success).toBe(false)
    expect(fileDirectoryEntriesSchema.safeParse([]).success).toBe(true)
  })

  it('drops a row the tree cannot place and keeps the rest of the directory', () => {
    const parsed = fileDirectoryEntriesSchema.parse([
      { name: 'src', isDirectory: true },
      { isDirectory: false },
      { name: 'readme.md' },
      { name: 'main.ts', isDirectory: false, isSymlink: true }
    ])
    expect(parsed.map((entry) => entry.name)).toEqual(['src', 'main.ts'])
  })

  it('salvages isSymlink without dropping the row', () => {
    expect(
      fileDirectoryEntriesSchema.parse([{ name: 'a', isDirectory: false, isSymlink: 'yes' }])[0]
        ?.isSymlink
    ).toBeUndefined()
  })

  it('requires the capped list and the note it draws', () => {
    expect(legacyFileListSchema.safeParse({ files: [] }).success).toBe(false)
    expect(legacyFileListSchema.safeParse({ truncated: false }).success).toBe(false)
    expect(legacyFileListSchema.safeParse({ files: [], truncated: true }).success).toBe(true)
  })

  it('drops a legacy row that names no path and keeps the rest', () => {
    const parsed = legacyFileListSchema.parse({
      files: [{ relativePath: 'a/b.ts' }, { basename: 'c.ts' }, { relativePath: 4 }],
      truncated: false
    })
    expect(parsed.files).toEqual([{ relativePath: 'a/b.ts' }])
  })

  it('passes a newer host member through on a directory row', () => {
    expect(
      fileDirectoryEntriesSchema.parse([{ name: 'a', isDirectory: false, sizeBytes: 12 }])[0]
    ).toMatchObject({ sizeBytes: 12 })
  })
})
