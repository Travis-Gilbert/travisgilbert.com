import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import remarkHtml from 'remark-html';

export type CollectionName = 'essays' | 'field-notes' | 'projects' | 'shelf' | 'toolkit';

export interface SourceRef {
  title: string;
  url: string;
}

export interface ProjectUrl {
  label: string;
  url: string;
}

export interface EssayData {
  title: string;
  date: Date;
  summary: string;
  youtubeId?: string;
  tags: string[];
  sources: SourceRef[];
  related: string[];
  draft: boolean;
  stage?: string;
  thesis?: string;
}

export interface FieldNoteData {
  title: string;
  date: Date;
  tags: string[];
  excerpt?: string;
  draft: boolean;
  status?: string;
  featured: boolean;
}

export interface ProjectData {
  title: string;
  role: string;
  description: string;
  year: number;
  date: Date;
  organization?: string;
  urls: ProjectUrl[];
  tags: string[];
  featured: boolean;
  draft: boolean;
  order: number;
  callout?: string;
}

export interface ShelfData {
  title: string;
  creator: string;
  type: string;
  annotation: string;
  url?: string;
  date: Date;
  tags: string[];
}

export interface ToolkitData {
  title: string;
  category: string;
  order: number;
}

export interface NowData {
  updated: string;
  researching: string;
  researching_context?: string;
  reading: string;
  reading_context?: string;
  building: string;
  building_context?: string;
  listening: string;
  listening_context?: string;
  thinking?: string;
}

export interface ContentEntry<T> {
  slug: string;
  data: T;
  body: string;
}

const CONTENT_ROOT = path.join(process.cwd(), 'content');

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asDate(value: unknown): Date {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.valueOf()) ? new Date(0) : date;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asSourceRefs(value: unknown): SourceRef[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rec = item as Record<string, unknown>;
    const title = asString(rec.title);
    const url = asString(rec.url);
    if (!title || !url) return [];
    return [{ title, url }];
  });
}

function asProjectUrls(value: unknown): ProjectUrl[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const rec = item as Record<string, unknown>;
    const label = asString(rec.label);
    const url = asString(rec.url);
    if (!label || !url) return [];
    return [{ label, url }];
  });
}

function readMarkdown(filePath: string): { data: Record<string, unknown>; content: string } {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  return {
    data: parsed.data as Record<string, unknown>,
    content: parsed.content,
  };
}

function listMarkdown(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.endsWith('.md'));
}

function parseEssay(data: Record<string, unknown>): EssayData {
  const youtubeId = asString(data.youtubeId);
  return {
    title: asString(data.title, 'Untitled'),
    date: asDate(data.date),
    summary: asString(data.summary),
    youtubeId: youtubeId || undefined,
    tags: asStringArray(data.tags),
    sources: asSourceRefs(data.sources),
    related: asStringArray(data.related),
    draft: asBoolean(data.draft),
    stage: asString(data.stage) || undefined,
    thesis: asString(data.thesis) || undefined,
  };
}

function parseFieldNote(data: Record<string, unknown>): FieldNoteData {
  return {
    title: asString(data.title, 'Untitled'),
    date: asDate(data.date),
    tags: asStringArray(data.tags),
    excerpt: asString(data.excerpt) || undefined,
    draft: asBoolean(data.draft),
    status: asString(data.status) || undefined,
    featured: asBoolean(data.featured),
  };
}

function parseProject(data: Record<string, unknown>): ProjectData {
  return {
    title: asString(data.title, 'Untitled'),
    role: asString(data.role),
    description: asString(data.description),
    year: asNumber(data.year, asDate(data.date).getFullYear()),
    date: asDate(data.date),
    organization: asString(data.organization) || undefined,
    urls: asProjectUrls(data.urls),
    tags: asStringArray(data.tags),
    featured: asBoolean(data.featured),
    draft: asBoolean(data.draft),
    order: asNumber(data.order),
    callout: asString(data.callout) || undefined,
  };
}

function parseShelf(data: Record<string, unknown>): ShelfData {
  return {
    title: asString(data.title, 'Untitled'),
    creator: asString(data.creator),
    type: asString(data.type, 'other'),
    annotation: asString(data.annotation),
    url: asString(data.url) || undefined,
    date: asDate(data.date),
    tags: asStringArray(data.tags),
  };
}

function parseToolkit(data: Record<string, unknown>): ToolkitData {
  return {
    title: asString(data.title, 'Untitled'),
    category: asString(data.category),
    order: asNumber(data.order),
  };
}

export function getCollection<T>(name: CollectionName): ContentEntry<T>[] {
  const dir = path.join(CONTENT_ROOT, name);
  const files = listMarkdown(dir);

  return files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const { data, content } = readMarkdown(path.join(dir, file));
    let parsed: unknown;
    if (name === 'essays') parsed = parseEssay(data);
    else if (name === 'field-notes') parsed = parseFieldNote(data);
    else if (name === 'projects') parsed = parseProject(data);
    else if (name === 'shelf') parsed = parseShelf(data);
    else parsed = parseToolkit(data);
    return { slug, data: parsed as T, body: content };
  });
}

export function getEntry<T>(name: CollectionName, slug: string): ContentEntry<T> | undefined {
  const filePath = path.join(CONTENT_ROOT, name, `${slug}.md`);
  if (!fs.existsSync(filePath)) return undefined;
  const { data, content } = readMarkdown(filePath);
  let parsed: unknown;
  if (name === 'essays') parsed = parseEssay(data);
  else if (name === 'field-notes') parsed = parseFieldNote(data);
  else if (name === 'projects') parsed = parseProject(data);
  else if (name === 'shelf') parsed = parseShelf(data);
  else parsed = parseToolkit(data);
  return { slug, data: parsed as T, body: content };
}

export function publishedEssays(): ContentEntry<EssayData>[] {
  return getCollection<EssayData>('essays')
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function publishedNotes(): ContentEntry<FieldNoteData>[] {
  return getCollection<FieldNoteData>('field-notes')
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function publishedProjects(): ContentEntry<ProjectData>[] {
  return getCollection<ProjectData>('projects')
    .filter((entry) => !entry.data.draft)
    .sort((a, b) => {
      if (a.data.order !== b.data.order) return a.data.order - b.data.order;
      return b.data.date.valueOf() - a.data.date.valueOf();
    });
}

export function getShelf(): ContentEntry<ShelfData>[] {
  return getCollection<ShelfData>('shelf').sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );
}

export function getToolkit(): ContentEntry<ToolkitData>[] {
  return getCollection<ToolkitData>('toolkit').sort((a, b) => a.data.order - b.data.order);
}

export function getNowData(): NowData | null {
  const filePath = path.join(CONTENT_ROOT, 'now.md');
  if (!fs.existsSync(filePath)) return null;
  const { data } = readMarkdown(filePath);
  const updated = asString(data.updated);
  const researching = asString(data.researching);
  const reading = asString(data.reading);
  const building = asString(data.building);
  const listening = asString(data.listening);
  if (!updated || !researching || !reading || !building || !listening) return null;
  return {
    updated,
    researching,
    researching_context: asString(data.researching_context) || undefined,
    reading,
    reading_context: asString(data.reading_context) || undefined,
    building,
    building_context: asString(data.building_context) || undefined,
    listening,
    listening_context: asString(data.listening_context) || undefined,
    thinking: asString(data.thinking) || undefined,
  };
}

export async function renderMarkdown(body: string): Promise<string> {
  const result = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(body);
  return result.toString();
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function estimateReadingTime(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function noteExcerpt(note: ContentEntry<FieldNoteData>): string {
  if (note.data.excerpt) return note.data.excerpt;
  const text = note.body.replace(/[#*_>`]/g, '').trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 217).trim()}...`;
}

export function hasBody(body: string): boolean {
  return body.trim().length > 0;
}
