import { z } from 'zod'
import type { RepoIcon } from '../../../src/shared/repo-icon'
import { salvagedOptional, salvagingArray } from '../../../src/shared/zod-salvage'

// Node's own platform domain, not Orca's: `host.platform` answers `process.platform` verbatim, so
// a string outside this set is not a platform the phone can reason about and reads as unknown.
const NODE_PLATFORMS = [
  'aix',
  'android',
  'darwin',
  'freebsd',
  'haiku',
  'linux',
  'openbsd',
  'sunos',
  'win32',
  'cygwin',
  'netbsd'
] as const

// What the host screen reads to label its rows and to mirror the desktop's workspace view store.
// Checked against src/main/runtime/rpc/methods/repo.ts:29, ssh.ts:55, host-capabilities.ts:8 and
// client-ui.ts:60/65, and the shared records they return: Repo in src/shared/repo-types.ts:42 and
// PersistedUIState's workspace-view subset in mobile/src/worktree/workspace-view-settings.ts:14.

/**
 * The host's repo catalog, narrowed to what the label maps are built from.
 *
 * `id` and `displayName` are required and a row without either drops: `displayName` is the key of
 * four Maps and the argument `repoColor` hashes with `name.charCodeAt` — a row without one was a
 * TypeError that took the whole metadata refresh with it — and `id` is the Map value the workspace
 * rows resolve their host through.
 *
 * `badgeColor` sits behind main's own `||` fallback to `repoColor`, so a salvaged member draws the
 * same swatch. `repoIcon` is declared as the three arms MobileRepoIcon renders, and an arm this
 * build has not heard of degrades to absent — which is the Folder default that component already
 * drew for an arm it could not match, so the row keeps its label either way.
 * The image arm deliberately stops at `src` and `label`: those are the members the component reads,
 * and `source` — which it never reads — is left to pass through. Declaring it as the four arms
 * `RepoIconImageSource` spells today would have dropped the WHOLE icon for a source a later host
 * adds, drawing a Folder where main drew the image; passthrough keeps the member on the object
 * verbatim, which is also what `settings-repo-metadata-icons` records.
 * `connectionId` and `executionHostId` are declared as plain strings rather than as
 * the host-id template union they are typed with: the union is a wire surface, and
 * `getRepoExecutionHostId` — which is what every read of them goes through — already answers `local`
 * for a spelling it cannot parse. Narrowing them here would refuse a newer host's own rows.
 */
export const hostRepoCatalogSchema = z
  .looseObject({
    repos: salvagingArray(
      z.looseObject({
        id: z.string(),
        displayName: z.string(),
        badgeColor: salvagedOptional('badgeColor', z.string()),
        repoIcon: salvagedOptional(
          'repoIcon',
          z.union([
            z.looseObject({ type: z.literal('lucide'), name: z.string() }),
            z.looseObject({ type: z.literal('emoji'), emoji: z.string() }),
            z.looseObject({
              type: z.literal('image'),
              src: z.string(),
              label: salvagedOptional('label', z.string())
            })
          ])
        ),
        connectionId: salvagedOptional('connectionId', z.string().nullable()),
        executionHostId: salvagedOptional('executionHostId', z.string().nullable())
      })
    )
  })
  .transform((reply) => reply.repos)

/**
 * The SSH target labels a mixed-host catalog names its rows with.
 *
 * The rows the label builder keeps are exactly the rows with a string `id` and `label`, so the
 * filter that used to sit in `readSshTargets` is the schema now and a row without either drops.
 * `targets` itself is salvaged rather than required because main answered `[]` for a reply without
 * it, and a `[]` here is what makes the labels degrade to host ids — the documented behaviour for a
 * host that predates the method.
 */
export const hostSshTargetSummariesSchema = z
  .looseObject({
    targets: salvagedOptional(
      'targets',
      salvagingArray(z.looseObject({ id: z.string(), label: z.string() }))
    )
  })
  .transform((reply) => reply.targets ?? [])

/**
 * The paired host's own platform.
 *
 * Salvaged to absent, which reads as null — main's own answer for a non-string or an empty one
 * (`typeof platform === 'string' && platform`), and the value that keeps the phone's platform from
 * naming the desktop. The arm set is closed over Node's platform domain rather than over anything
 * Orca versions: the handler returns `process.platform` and nothing else, and a string outside that
 * set names no path convention this client could apply.
 */
export const hostPlatformSchema = z
  .looseObject({ platform: salvagedOptional('platform', z.enum(NODE_PLATFORMS)) })
  .transform((reply) => reply.platform ?? null)

/**
 * The desktop's shared workspace view settings, read off `ui.get`'s `ui` member.
 *
 * Nothing is required: applyDesktopViewSettings reads every member behind `??` or a mapping table
 * that answers null for an arm it does not know, so a salvaged member leaves the local value in
 * place — which is exactly what main did for an absent one. `groupBy` and `sortBy` are closed arm
 * sets that degrade to absent for the same reason: every read is a lookup that already fell back to
 * the current mode for an arm it could not map, so nothing is withheld that the reply granted.
 *
 * `workspaceStatuses` keeps its rows opaque — coerceMobileWorkspaceStatuses only counts them — but
 * the container is checked, because main handed a non-array straight into the status catalog and
 * every group lookup then read `.find` off a string.
 *
 * The `ui` member itself is required. Main read it off the payload with a bare property access that
 * threw a TypeError on a null result, and the host screen's own try/catch is where that throw has
 * always landed; an incompatible reply reaches the same catch with the method named.
 */
export const hostViewSettingsSchema = z
  .looseObject({
    ui: z.looseObject({
      groupBy: salvagedOptional(
        'groupBy',
        z.enum(['none', 'workspace-status', 'repo', 'pr-status'])
      ),
      sortBy: salvagedOptional('sortBy', z.enum(['name', 'smart', 'recent', 'repo', 'manual'])),
      hideSleepingWorkspaces: salvagedOptional('hideSleepingWorkspaces', z.boolean()),
      hideDefaultBranchWorkspace: salvagedOptional('hideDefaultBranchWorkspace', z.boolean()),
      alwaysShowDefaultBranchWorkspace: salvagedOptional(
        'alwaysShowDefaultBranchWorkspace',
        z.boolean()
      ),
      filterRepoIds: salvagedOptional('filterRepoIds', z.array(z.string())),
      collapsedGroups: salvagedOptional('collapsedGroups', z.array(z.string())),
      workspaceStatuses: salvagedOptional(
        'workspaceStatuses',
        z.array(z.looseObject({ id: z.string(), label: z.string() }))
      )
    })
  })
  .transform((reply) => reply.ui)

/**
 * The four host-list writes whose reply body no call site reads.
 *
 * The `ui.set` patch, the pin write, the row delete and the activate ping are all decided by the
 * acceptance verdict alone — the pin write never interprets its reply at all, and the delete reads
 * `accepted` and nothing else.
 *
 * `worktree.activate` is the one of the four whose payload a *second* consumer looks at, and it is
 * deliberately left opaque: headlessActivationNeedsHostRenderer is a total guard over `unknown`
 * (worktree-activation-result.ts:1), and the session route's second report site awaits its send
 * outside any catch, so a reader that could throw would turn an unreadable activation into an
 * unhandled rejection where main showed no toast.
 */
export const hostScreenUnreadReplySchema = z.unknown()

/** One decoded catalog icon: the members MobileRepoIcon reads, with the rest passed through. */
export type MobileHostRepoIcon = NonNullable<
  z.output<typeof hostRepoCatalogSchema>[number]['repoIcon']
>

/** What MobileRepoIcon renders: a decoded catalog icon, or the `RepoIcon` a worktree row carries. */
export type MobileRenderableRepoIcon = MobileHostRepoIcon | RepoIcon
