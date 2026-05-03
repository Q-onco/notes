export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
  audioIds: string[];
}

export interface JournalEntry {
  id: string;
  body: string;
  mood: string;
  contextTag: string;
  createdAt: number;
  updatedAt: number;
  audioIds: string[];
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  noteId: string | null;
  createdAt: number;
  dueAt: number | null;
  priority: 'high' | 'medium' | 'low';
}

export interface AudioRecord {
  id: string;
  createdAt: number;
  durationSec: number;
  transcript: string;
  noteId: string | null;
  journalId: string | null;
  sizeBytes: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model: string;
  tokens: number;
}

export interface ChatSession {
  id: string;
  date: string;
  messages: ChatMessage[];
  noteContext: string | null;
}

export interface CalendarEvent {
  uid: string;
  summary: string;
  start: number;
  end: number;
  location: string;
  description: string;
  source: 'apple';
}

export interface AppSettings {
  userName: string;
  groqKey: string;
  workerUrl: string;
  themeOverride: 'auto' | 'light' | 'dark';
  groqModel: 'quick' | 'deep';
}

export interface EncryptedBlob {
  v: number;
  s: string;
  i: string;
  d: string;
}

export interface GithubFile {
  sha: string;
  content: string;
}

export interface WeatherData {
  city: string;
  tempC: number;
  desc: string;
  humidity: number;
  windKph: number;
  icon: string;
}

export interface PaperResult {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  journal: string;
  year: number;
  doi: string;
  url: string;
  source: 'pubmed' | 'biorxiv' | 'medrxiv' | 'nature' | 'cell';
}
