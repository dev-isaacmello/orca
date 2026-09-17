import { z } from 'zod'
import { openEnum, salvagedOptional, salvagingArray } from '../../../src/shared/zod-salvage'

// The dictation setup sheet's reads and writes, and the three sends one dictation session makes.
// Checked against src/main/runtime/rpc/methods/speech.ts:12-59 and the shared results the speech
// catalog and dictation controller return: RuntimeSpeechSetupState and RuntimeSpeechModelSummary in
// src/shared/runtime-worktree-contracts.ts:81-96.

const SPEECH_MODEL_PROVIDERS = ['local', 'openai'] as const
const SPEECH_MODEL_STATUSES = [
  'ready',
  'not-downloaded',
  'downloading',
  'extracting',
  'error'
] as const
const DICTATION_MODES = ['toggle', 'hold'] as const

/**
 * One model row in the setup sheet.
 *
 * `id` is required: it is the React key the list renders by, the value `isSelected` compares
 * against, and — the reason it cannot be salvaged — the `modelId` the download, delete and select
 * sends put back on the wire. A row without one drops rather than failing the whole sheet, which is
 * the same rule the terminal inventory uses for a row it cannot address.
 *
 * `provider` and `status` are closed arm sets on the wire, so an arm this build has not heard of
 * degrades to absent rather than refusing the reply or dropping the row. Absent is the right
 * degrade here and not a coincidence: every read of either is an equality test against a known arm
 * (`provider === 'openai'`, `status === 'ready'`, isModelInFlight), so an unknown arm already fell
 * through to the same branch on main. Nothing is withheld that the row otherwise granted.
 *
 * `label`, `sizeBytes` and `progress` are decoration behind main's own guards — `!bytes`,
 * `progress != null` — so a salvaged member lands on exactly the meta string main drew.
 * `recommended` stays `z.unknown()` because the badge gates on truthiness, not on `=== true`.
 */
const speechModelSchema = z.looseObject({
  id: z.string(),
  label: salvagedOptional('label', z.string()),
  provider: salvagedOptional('provider', z.enum(SPEECH_MODEL_PROVIDERS)),
  status: salvagedOptional('status', z.enum(SPEECH_MODEL_STATUSES)),
  sizeBytes: salvagedOptional('sizeBytes', z.number().nullable()),
  progress: salvagedOptional('progress', z.number().nullable()),
  recommended: z.unknown().optional()
})

/**
 * The whole dictation setup, which all three of the list, the delete and the config write answer
 * with — the sheet renders the reply in place of a refetch, so one schema covers the three.
 *
 * `models` is required: MobileDictationSetupSheet.tsx:49 and VoiceModelList.tsx:53 read `.some` and
 * `.map` on it with no guard, so a reply without one was a TypeError inside the sheet's own refresh.
 *
 * `dictationMode` is required and its arm set is open, degrading to `toggle`. It is the one member
 * a consumer cannot supply a value for: use-mobile-session-native-chat-dictation.ts:199 pushes it
 * straight into a `useState<'toggle' | 'hold'>` whose own initial value is `toggle`, so an unknown
 * arm degrades to the state the screen already starts in rather than to a value that matches no
 * segment. The host declares it required and has always sent it.
 *
 * `enabled` and `selectedModelId` stay salvaged: both are read behind `!`/`===` and a reply missing
 * either renders an off switch and no selected row, which is what main rendered for the same reply.
 */
export const dictationSetupSchema = z.looseObject({
  enabled: salvagedOptional('enabled', z.boolean()),
  selectedModelId: salvagedOptional('selectedModelId', z.string()),
  dictationMode: openEnum(DICTATION_MODES, 'toggle'),
  models: salvagingArray(speechModelSchema)
})

export type MobileSpeechSetupReply = z.output<typeof dictationSetupSchema>
export type MobileSpeechModelReply = MobileSpeechSetupReply['models'][number]

/**
 * The five dictation sends whose reply body no call site reads.
 *
 * `speech.models.download` answers `{ started: true }` and the sheet polls the list instead; the
 * start, chunk and cancel replies are interpreted for their acceptance verdict alone. Declaring a
 * member on any of them would be a requirement with no reader behind it.
 *
 * `speech.dictation.finish` is here for a different reason, and it is the one site in this domain
 * left deliberately unchecked. Its transcript is read at the call site through `rpcPayloadMember`
 * *after* a staleness guard (use-mobile-dictation.ts:237), and the interpretation that a schema
 * would fail runs before that guard. Checking it would report an unreadable reply for a dictation
 * the user had already superseded, where main returned silently; the member read itself is guarded
 * by `typeof transcript === 'string'` and is fenced by the raw-port inventory.
 */
export const dictationUnreadReplySchema = z.unknown()
