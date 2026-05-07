import type { GithubFile } from './types';
import { encryptObjWithToken, decryptObjWithToken } from './crypto';

const API = 'https://api.github.com';
const REPO = 'Q-onco/notes';
const BRANCH = 'main';

// Data file paths
export const PATHS = {
  notes:        'data/notes.enc',
  journal:      'data/journal.enc',
  tasks:        'data/tasks.enc',
  chat:         'data/chat.enc',
  audio:        'data/audio.enc',
  pinned:       'data/pinned.enc',
  settings:     'settings/keys.enc',
  research:     'data/research.enc',
  pipelines:    'data/pipelines.enc',
  jobs:         'data/jobs.enc',
  jobExt:       'data/jobs-ext.enc',
  cv:           'data/cv.enc',
  coverLetters:  'data/coverletters.enc',
  profile:       'settings/profile.enc',
  presentations: 'data/presentations.enc',
  files:         'data/files.enc',
  grants:        'data/grants.enc',
  conferences:   'data/conferences.enc',
  peerReviews:   'data/peer-reviews.enc',
  manuscripts:   'data/manuscripts.enc',
  reviews:       'data/reviews.enc',
} as const;

function headers(token: string) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };
}

function ghDec(content: string): string {
  return decodeURIComponent(escape(atob(content.replace(/\n/g, ''))));
}

function ghEnc(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

export async function ghGet(token: string, path: string): Promise<GithubFile | null> {
  const res = await fetch(`${API}/repos/${REPO}/contents/${path}?ref=${BRANCH}`, {
    headers: headers(token)
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return { sha: json.sha, content: ghDec(json.content) };
}

export async function ghPut(
  token: string,
  path: string,
  content: string,
  sha: string | null,
  message: string
): Promise<string> {
  const body: Record<string, unknown> = {
    message,
    content: ghEnc(content),
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  const res = await fetch(`${API}/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body)
  });

  if (res.status === 422 || res.status === 409) {
    throw new Error('Save conflict — data was modified elsewhere. Please retry.');
  }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);

  const json = await res.json();
  return json.content.sha as string;
}

export async function validateToken(token: string): Promise<{ login: string }> {
  const res = await fetch(`${API}/repos/${REPO}`, { headers: headers(token) });
  if (!res.ok) throw new Error('Token invalid or no access to Q-onco/notes');
  const data = await fetch(`${API}/user`, { headers: headers(token) });
  const user = await data.json();
  return { login: user.login };
}

// Generic load: fetch file, decrypt, return parsed object + sha
export async function loadEncFile<T>(
  token: string,
  path: string,
  defaultValue: T
): Promise<{ data: T; sha: string | null }> {
  try {
    const file = await ghGet(token, path);
    if (!file) return { data: defaultValue, sha: null };
    const data = await decryptObjWithToken<T>(file.content, token);
    return { data, sha: file.sha };
  } catch {
    return { data: defaultValue, sha: null };
  }
}

// Generic save: encrypt, commit
export async function saveEncFile<T>(
  token: string,
  path: string,
  data: T,
  sha: string | null,
  message: string
): Promise<string> {
  const encrypted = await encryptObjWithToken(data, token);
  return ghPut(token, path, encrypted, sha, message);
}

// Commit a plain text file (for session logs)
export async function commitTextFile(
  token: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  // Check for existing sha
  let sha: string | null = null;
  try {
    const file = await ghGet(token, path);
    if (file) sha = file.sha;
  } catch {
    // file doesn't exist yet — fine
  }
  await ghPut(token, path, content, sha, message);
}
