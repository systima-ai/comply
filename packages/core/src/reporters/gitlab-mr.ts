import type { ScanResult, ComplianceDiff } from '../types'
import { formatGitHubPRComment } from './github-pr'

export function formatGitLabMRNote(
  result: ScanResult,
  diff?: ComplianceDiff,
): string {
  return formatGitHubPRComment(result, diff)
}

export interface GitLabMRCommentOptions {
  projectId: string | number
  mergeRequestIid: number
  privateToken: string
  gitlabUrl?: string
}

export async function postGitLabMRComment(
  comment: string,
  options: GitLabMRCommentOptions,
): Promise<void> {
  const baseUrl = options.gitlabUrl ?? 'https://gitlab.com'
  const url = `${baseUrl}/api/v4/projects/${options.projectId}/merge_requests/${options.mergeRequestIid}/notes`

  const existingResponse = await fetch(url, {
    headers: {
      'PRIVATE-TOKEN': options.privateToken,
    },
  })

  if (existingResponse.ok) {
    const notes = (await existingResponse.json()) as Array<{
      id: number
      body: string
      system: boolean
    }>

    const existingNote = notes.find(
      (n) => !n.system && n.body.includes('Systima Comply'),
    )

    if (existingNote) {
      await fetch(`${url}/${existingNote.id}`, {
        method: 'PUT',
        headers: {
          'PRIVATE-TOKEN': options.privateToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: comment }),
      })
      return
    }
  }

  await fetch(url, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': options.privateToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: comment }),
  })
}
