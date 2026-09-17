import { describe, expect, it } from 'vitest'
import {
  hostPlatformSchema,
  hostRepoCatalogSchema,
  hostSshTargetSummariesSchema,
  hostViewSettingsSchema
} from './host-screen-reply-schema'

describe('host screen reply schemas', () => {
  it('requires the repo list and drops a row no map could key', () => {
    expect(hostRepoCatalogSchema.safeParse({}).success).toBe(false)
    const parsed = hostRepoCatalogSchema.parse({
      repos: [{ id: 'r1', displayName: 'orca' }, { id: 'r2' }, { displayName: 'ghost' }]
    })
    expect(parsed.map((repo) => repo.id)).toEqual(['r1'])
  })

  it('salvages badgeColor onto the generated swatch main fell back to', () => {
    expect(
      hostRepoCatalogSchema.parse({ repos: [{ id: 'r', displayName: 'o', badgeColor: 3 }] })[0]
        ?.badgeColor
    ).toBeUndefined()
  })

  it('keeps a known repo icon arm and degrades an unknown one to absent', () => {
    const known = hostRepoCatalogSchema.parse({
      repos: [{ id: 'r', displayName: 'o', repoIcon: { type: 'emoji', emoji: 'x' } }]
    })
    expect(known[0]?.repoIcon).toEqual({ type: 'emoji', emoji: 'x' })
    const unknown = hostRepoCatalogSchema.parse({
      repos: [{ id: 'r', displayName: 'o', repoIcon: { type: 'svg', markup: '<svg/>' } }]
    })
    // The row survives and draws the Folder default MobileRepoIcon already drew for an arm it
    // could not match.
    expect(unknown[0]?.id).toBe('r')
    expect(unknown[0]?.repoIcon).toBeUndefined()
  })

  it('keeps an image icon whose source this build has never heard of', () => {
    const [repo] = hostRepoCatalogSchema.parse({
      repos: [
        {
          id: 'r',
          displayName: 'o',
          repoIcon: {
            type: 'image',
            src: 'https://example.invalid/a.png',
            source: 'gitlab',
            label: 'acme/orca'
          }
        }
      ]
    })
    // MobileRepoIcon reads src and label and never source, so narrowing source would have drawn a
    // Folder where main drew the image. The member itself still reaches the row.
    expect(repo?.repoIcon).toEqual({
      type: 'image',
      src: 'https://example.invalid/a.png',
      source: 'gitlab',
      label: 'acme/orca'
    })
  })

  it('passes a host-id spelling through for getRepoExecutionHostId to judge', () => {
    const [repo] = hostRepoCatalogSchema.parse({
      repos: [{ id: 'r', displayName: 'o', executionHostId: 'cloud:zone-a', connectionId: null }]
    })
    expect(repo?.executionHostId).toBe('cloud:zone-a')
    expect(repo?.connectionId).toBeNull()
  })

  it('degrades an unreadable ssh target list to the empty one that falls back to host ids', () => {
    expect(hostSshTargetSummariesSchema.parse({})).toEqual([])
    expect(hostSshTargetSummariesSchema.parse({ targets: 'none' })).toEqual([])
    expect(
      hostSshTargetSummariesSchema.parse({
        targets: [{ id: 't', label: 'T' }, { id: 'u' }, { label: 'V' }]
      })
    ).toEqual([{ id: 't', label: 'T' }])
  })

  it('reads only a platform Node could have reported', () => {
    expect(hostPlatformSchema.parse({ platform: 'win32' })).toBe('win32')
    expect(hostPlatformSchema.parse({ platform: 'plan9' })).toBeNull()
    expect(hostPlatformSchema.parse({ platform: '' })).toBeNull()
    expect(hostPlatformSchema.parse({})).toBeNull()
  })

  it('requires the ui member main read with a bare property access', () => {
    expect(hostViewSettingsSchema.safeParse({}).success).toBe(false)
    expect(hostViewSettingsSchema.safeParse(null).success).toBe(false)
    expect(hostViewSettingsSchema.parse({ ui: {} })).toEqual({})
  })

  it('degrades an unknown grouping or sort arm to absent so the local mode is kept', () => {
    const parsed = hostViewSettingsSchema.parse({
      ui: { groupBy: 'agent', sortBy: 'stars', hideSleepingWorkspaces: 'yes' }
    })
    expect(parsed.groupBy).toBeUndefined()
    expect(parsed.sortBy).toBeUndefined()
    expect(parsed.hideSleepingWorkspaces).toBeUndefined()
  })

  it('keeps the known view arms and the lists the screen adopts', () => {
    const parsed = hostViewSettingsSchema.parse({
      ui: {
        groupBy: 'workspace-status',
        sortBy: 'recent',
        filterRepoIds: ['r1'],
        collapsedGroups: [],
        workspaceStatuses: [{ id: 'active', label: 'Active' }]
      }
    })
    expect(parsed.groupBy).toBe('workspace-status')
    expect(parsed.sortBy).toBe('recent')
    expect(parsed.filterRepoIds).toEqual(['r1'])
    expect(parsed.workspaceStatuses).toEqual([{ id: 'active', label: 'Active' }])
  })

  it('salvages a non-array status catalog rather than handing a string to the group lookups', () => {
    expect(
      hostViewSettingsSchema.parse({ ui: { workspaceStatuses: 'active' } }).workspaceStatuses
    ).toBeUndefined()
  })
})
