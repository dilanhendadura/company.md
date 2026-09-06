import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { isRecord } from './parser.js';

export interface ResolveOptions {
  subject?: string;
  artifact?: string;
  workspaceRoot?: string;
}

export interface ArtifactBinding {
  design?: string;
  template?: string;
  templateSkill?: string;
}

export interface ResolvedContext {
  pack: string;
  workspaceRoot: string;
  reason: 'explicit-subject' | 'nearest-pack' | 'only-subject';
  subject?: string;
  kind?: string;
  parent?: string;
  registry?: string;
  artifact?: string;
  binding?: ArtifactBinding;
  /** Registered descendant packs form separate brand boundaries. */
  nestedPackRoots?: string[];
}

interface Subject {
  id: string;
  kind: string;
  pack: string;
  aliases: string[];
  parent?: string;
  artifacts: Record<string, ArtifactBinding>;
}

export function insideRoot(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Canonicalize before reading: lexical '..' and symlink escapes are both rejected. */
export function safePath(candidate: string, root: string): string {
  const canonicalRoot = fs.realpathSync(root);
  const absolute = path.resolve(candidate);
  const canonical = fs.realpathSync(absolute);
  if (!insideRoot(canonical, canonicalRoot)) throw new Error(`Path resolves outside workspace root: ${candidate}`);
  return canonical;
}

export function workspaceBoundary(input: string, explicit?: string): string {
  const absolute = fs.realpathSync(path.resolve(input));
  const directory = fs.statSync(absolute).isDirectory() ? absolute : path.dirname(absolute);
  if (explicit) {
    const boundary = fs.realpathSync(path.resolve(explicit));
    if (!fs.statSync(boundary).isDirectory()) throw new Error('workspace root must be a directory');
    safePath(absolute, boundary);
    return boundary;
  }
  let current = directory;
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return directory;
    current = parent;
  }
}

export function resolveContext(input: string, options: ResolveOptions = {}): ResolvedContext {
  const workspaceRoot = workspaceBoundary(input, options.workspaceRoot);
  const absolute = safePath(path.resolve(input), workspaceRoot);
  const isFile = fs.statSync(absolute).isFile();
  const directory = isFile ? path.dirname(absolute) : absolute;
  let current = directory;
  let nearest: string | undefined = isFile && !/\.ya?ml$/i.test(absolute) ? absolute : undefined;
  let registry: string | undefined = isFile && /\.ya?ml$/i.test(absolute) ? absolute : undefined;
  while (true) {
    if (!nearest) nearest = companyFile(current);
    const candidate = path.join(current, 'companymd.yaml');
    if (!registry && fs.existsSync(candidate)) registry = safePath(candidate, workspaceRoot);
    if (current === workspaceRoot) break;
    const parent = path.dirname(current);
    if (!insideRoot(parent, workspaceRoot)) break;
    current = parent;
  }
  if (registry) {
    const subjects = readRegistry(registry, workspaceRoot);
    const requested = options.subject?.trim().toLocaleLowerCase('en-US');
    const matched = requested
      ? subjects.filter(subject => [subject.id, ...subject.aliases].some(alias => alias.toLocaleLowerCase('en-US') === requested))
      : nearest ? subjects.filter(subject => subject.pack === fs.realpathSync(nearest!)) : subjects;
    if (matched.length !== 1) {
      throw new Error(`${requested && matched.length === 0 ? `Unknown subject ${options.subject}` : 'Ambiguous company context'}; select --subject from: ${subjects.map(s => s.id).join(', ')}`);
    }
    const selected = matched[0]!;
    const binding = options.artifact && Object.hasOwn(selected.artifacts, options.artifact) ? selected.artifacts[options.artifact] : undefined;
    // A declared artifact map is a contract: an unknown format is not a fallback.
    if (options.artifact && Object.keys(selected.artifacts).length && !binding) {
      throw new Error(`Subject ${selected.id} has no ${options.artifact} artifact binding`);
    }
    return {
      pack: selected.pack, workspaceRoot, registry,
      subject: selected.id, kind: selected.kind,
      ...(selected.parent ? { parent: selected.parent } : {}),
      ...(options.artifact ? { artifact: options.artifact } : {}),
      ...(binding ? { binding } : {}),
      nestedPackRoots: subjects.filter(subject => subject !== selected && insideRoot(path.dirname(subject.pack), path.dirname(selected.pack)))
        .map(subject => path.dirname(subject.pack)),
      reason: requested ? 'explicit-subject' : nearest ? 'nearest-pack' : 'only-subject',
    };
  }
  if (!nearest) throw new Error(`No COMPANY.md or companymd.yaml found inside ${workspaceRoot}`);
  return {
    pack: safePath(nearest, workspaceRoot), workspaceRoot,
    reason: options.subject ? 'explicit-subject' : 'nearest-pack',
    ...(options.subject ? { subject: options.subject } : {}),
    ...(options.artifact ? { artifact: options.artifact } : {}),
  };
}

function companyFile(directory: string): string | undefined {
  return ['COMPANY.md', 'company.md', 'Company.md'].map(name => path.join(directory, name))
    .find(file => fs.existsSync(file) && fs.statSync(file).isFile());
}

function readRegistry(file: string, boundary: string): Subject[] {
  const parsed: unknown = parseYaml(fs.readFileSync(file, 'utf8'));
  if (!isRecord(parsed) || parsed.schema !== 'companymd/registry/v1' || !Array.isArray(parsed.subjects) || !parsed.subjects.length) {
    throw new Error('Registry requires schema: companymd/registry/v1 and a non-empty subjects array');
  }
  if (Object.keys(parsed).some(key => !['schema', 'subjects'].includes(key))) throw new Error('Unknown registry field');
  const base = path.dirname(file);
  const names = new Set<string>();
  const packs = new Set<string>();
  const subjects = parsed.subjects.map((raw: unknown): Subject => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,127}$/.test(raw.id)
      || typeof raw.kind !== 'string' || !['group', 'company', 'product', 'brand'].includes(raw.kind) || typeof raw.pack !== 'string') {
      throw new Error('Each registry subject requires a stable id, kind (group/company/product/brand), and local pack path');
    }
    if (Object.keys(raw).some(key => !['id', 'name', 'kind', 'parent', 'aliases', 'pack', 'artifacts'].includes(key))) throw new Error(`Unknown subject field in ${raw.id}`);
    if (raw.name !== undefined && (typeof raw.name !== 'string' || !raw.name.trim())) throw new Error(`Invalid name for ${raw.id}`);
    if (!raw.pack.trim()) throw new Error(`Empty pack path for ${raw.id}`);
    const aliases = raw.aliases === undefined ? [] : raw.aliases;
    if (!Array.isArray(aliases) || aliases.some(a => typeof a !== 'string' || !a.trim())) throw new Error(`Invalid aliases for ${raw.id}`);
    for (const alias of [raw.id, ...aliases] as string[]) {
      const key = alias.toLocaleLowerCase('en-US').trim();
      if (names.has(key)) throw new Error(`Duplicate subject id or alias: ${alias}`);
      names.add(key);
    }
    let pack = safePath(path.resolve(base, raw.pack), boundary);
    if (fs.statSync(pack).isDirectory()) {
      const candidate = companyFile(pack);
      if (!candidate) throw new Error(`No COMPANY.md for subject ${raw.id}`);
      pack = safePath(candidate, boundary);
    }
    if (packs.has(pack)) throw new Error(`Multiple subjects reference the same pack: ${raw.pack}`);
    packs.add(pack);
    const artifacts: Record<string, ArtifactBinding> = Object.create(null);
    if (raw.artifacts !== undefined && !isRecord(raw.artifacts)) throw new Error(`Invalid artifact bindings for ${raw.id}`);
    for (const [format, value] of Object.entries(isRecord(raw.artifacts) ? raw.artifacts : {})) {
      if (!isRecord(value) || !Object.keys(value).length) throw new Error(`Empty artifact binding: ${raw.id}/${format}`);
      const binding: ArtifactBinding = {};
      for (const [key, source] of Object.entries(value)) {
        if (!['design', 'template', 'templateSkill'].includes(key) || typeof source !== 'string' || !source.trim()) throw new Error(`Unknown or invalid artifact binding field: ${key}`);
        const resolved = safePath(path.resolve(base, source), boundary);
        if (!fs.statSync(resolved).isFile()) throw new Error(`Artifact binding must identify a file: ${source}`);
        binding[key as keyof ArtifactBinding] = resolved;
      }
      artifacts[format] = binding;
    }
    if (raw.parent !== undefined && (typeof raw.parent !== 'string' || !raw.parent.trim())) throw new Error(`Invalid parent for ${raw.id}`);
    return { id: raw.id, kind: raw.kind, pack, aliases: (aliases as string[]).map(alias => alias.trim()), artifacts, ...(typeof raw.parent === 'string' ? { parent: raw.parent } : {}) };
  });
  const byId = new Map(subjects.map(subject => [subject.id, subject]));
  for (const subject of subjects) {
    const visited = new Set<string>([subject.id]);
    let parent = subject.parent;
    while (parent) {
      if (visited.has(parent)) throw new Error(`Organization parent cycle at ${parent}`);
      const found = byId.get(parent);
      if (!found) throw new Error(`Unknown parent ${parent} for ${subject.id}`);
      visited.add(parent);
      parent = found.parent;
    }
  }
  return subjects;
}
