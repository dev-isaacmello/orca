// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { LinearIssue } from '../../../shared/linear/issue-types'
import type { LinearGroupBy } from '../../../shared/linear/issue-view-resume-state'
import type { LinearIssueListRow } from './task-page-linear-issue-model'
import type { TaskPageLinearListProjectionPreludeModel } from './use-task-page-linear-list-projection'
import { useTaskPageLinearListPresentation } from './use-task-page-linear-list-presentation'

function issue(identifier: string, status: string, teamId = 'team-1'): LinearIssue {
  return {
    id: identifier,
    identifier,
    title: identifier,
    url: 'https://linear.app/issue',
    priority: 0,
    updatedAt: '2026-01-02T00:00:00.000Z',
    state: { name: status, type: 'unstarted', color: '#000' },
    team: { id: teamId, name: teamId, key: 'COR' },
    labels: [],
    labelIds: []
  }
}

const TODO_ONE = issue('COR-1', 'Todo')
const TODO_TWO = issue('COR-2', 'Todo')
const DONE_ONE = issue('COR-3', 'Done')

function preludeModel(
  linearGroupBy: LinearGroupBy,
  pagedLinearIssues: LinearIssue[]
): TaskPageLinearListProjectionPreludeModel {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the prelude model is a wide derived type, but the presentation hook reads only the seven fields listed here.
  return {
    linearDisplayProperties: new Set<string>(),
    linearGroupBy,
    linearOrderBy: 'identifier',
    linearTeamOptions: [],
    linearTeamPropertyTouched: false,
    linearTeamSelection: new Set<string>(),
    pagedLinearIssues
  } as unknown as TaskPageLinearListProjectionPreludeModel
}

function sectionKeys(rows: LinearIssueListRow[]): string[] {
  return rows.flatMap((row) => (row.type === 'section' ? [row.key] : []))
}

function collapsedKeys(rows: LinearIssueListRow[]): string[] {
  return rows.flatMap((row) => (row.type === 'section' && row.collapsed ? [row.key] : []))
}

function issueIdentifiers(rows: LinearIssueListRow[]): string[] {
  return rows.flatMap((row) => (row.type === 'issue' ? [row.issue.identifier] : []))
}

function renderGroupedList(
  linearGroupBy: LinearGroupBy = 'status',
  issues: LinearIssue[] = [TODO_ONE, TODO_TWO, DONE_ONE]
) {
  return renderHook(
    ({ groupBy, pagedIssues }: { groupBy: LinearGroupBy; pagedIssues: LinearIssue[] }) =>
      useTaskPageLinearListPresentation(preludeModel(groupBy, pagedIssues)),
    { initialProps: { groupBy: linearGroupBy, pagedIssues: issues } }
  )
}

describe('useTaskPageLinearListPresentation collapse', () => {
  it('hides a collapsed section and marks its header row', () => {
    const view = renderGroupedList()

    expect(issueIdentifiers(view.result.current.linearIssueListRows)).toEqual([
      'COR-1',
      'COR-2',
      'COR-3'
    ])
    expect(collapsedKeys(view.result.current.linearIssueListRows)).toEqual([])

    act(() => {
      view.result.current.toggleLinearSection('status:Todo')
    })

    expect(collapsedKeys(view.result.current.linearIssueListRows)).toEqual(['status:Todo'])
    expect(issueIdentifiers(view.result.current.linearIssueListRows)).toEqual(['COR-3'])
  })

  it('keeps the header row and its count while the section is collapsed', () => {
    const view = renderGroupedList()

    act(() => {
      view.result.current.toggleLinearSection('status:Todo')
    })

    const header = view.result.current.linearIssueListRows.find(
      (row) => row.type === 'section' && row.key === 'status:Todo'
    )
    expect(header).toEqual({
      type: 'section',
      key: 'status:Todo',
      label: 'Todo',
      count: 2,
      collapsed: true
    })
  })

  it('restores the rows when the same section is toggled again', () => {
    const view = renderGroupedList()

    act(() => {
      view.result.current.toggleLinearSection('status:Todo')
    })
    act(() => {
      view.result.current.toggleLinearSection('status:Todo')
    })

    expect(collapsedKeys(view.result.current.linearIssueListRows)).toEqual([])
    expect(issueIdentifiers(view.result.current.linearIssueListRows)).toEqual([
      'COR-1',
      'COR-2',
      'COR-3'
    ])
  })

  it('leaves other sections untouched when one collapses', () => {
    const view = renderGroupedList()

    act(() => {
      view.result.current.toggleLinearSection('status:Done')
    })

    expect(sectionKeys(view.result.current.linearIssueListRows)).toEqual([
      'status:Todo',
      'status:Done'
    ])
    expect(collapsedKeys(view.result.current.linearIssueListRows)).toEqual(['status:Done'])
    expect(issueIdentifiers(view.result.current.linearIssueListRows)).toEqual(['COR-1', 'COR-2'])
  })

  it('clears collapsed sections when the grouping changes', () => {
    const view = renderGroupedList()

    act(() => {
      view.result.current.toggleLinearSection('status:Todo')
    })
    view.rerender({ groupBy: 'team', pagedIssues: [TODO_ONE, TODO_TWO, DONE_ONE] })
    view.rerender({ groupBy: 'status', pagedIssues: [TODO_ONE, TODO_TWO, DONE_ONE] })

    expect(collapsedKeys(view.result.current.linearIssueListRows)).toEqual([])
    expect(issueIdentifiers(view.result.current.linearIssueListRows)).toEqual([
      'COR-1',
      'COR-2',
      'COR-3'
    ])
  })

  it('keeps a section collapsed when a new page of issues arrives', () => {
    const view = renderGroupedList()

    act(() => {
      view.result.current.toggleLinearSection('status:Todo')
    })
    view.rerender({
      groupBy: 'status',
      pagedIssues: [TODO_ONE, TODO_TWO, issue('COR-4', 'Todo'), DONE_ONE]
    })

    expect(collapsedKeys(view.result.current.linearIssueListRows)).toEqual(['status:Todo'])
    expect(issueIdentifiers(view.result.current.linearIssueListRows)).toEqual(['COR-3'])
  })

  it('renders no section rows and ignores a toggle when grouping is none', () => {
    const view = renderGroupedList('none')

    expect(sectionKeys(view.result.current.linearIssueListRows)).toEqual([])

    act(() => {
      view.result.current.toggleLinearSection('all')
    })

    expect(sectionKeys(view.result.current.linearIssueListRows)).toEqual([])
    expect(issueIdentifiers(view.result.current.linearIssueListRows)).toEqual([
      'COR-1',
      'COR-2',
      'COR-3'
    ])
  })
})
