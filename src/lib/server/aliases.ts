import { env } from '$env/dynamic/private';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AliasEntry = { name: string; updatedAt: number };
type AliasStore = Record<string, AliasEntry>;

const dataDirectory = path.resolve(env.DATA_DIR || 'data');
const aliasPath = path.join(dataDirectory, 'aliases.json');
let writeQueue = Promise.resolve();

export async function readAliases(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(aliasPath, 'utf8');
    const parsed = JSON.parse(raw) as AliasStore;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => value && typeof value.name === 'string')
        .map(([playerId, value]) => [playerId, value.name])
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return {};
    throw error;
  }
}

export async function setAlias(playerId: string, name: string) {
  writeQueue = writeQueue.then(async () => {
    await mkdir(dataDirectory, { recursive: true });

    let aliases: AliasStore = {};
    try {
      aliases = JSON.parse(await readFile(aliasPath, 'utf8')) as AliasStore;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    const normalized = name.trim();
    if (normalized) aliases[playerId] = { name: normalized, updatedAt: Date.now() };
    else delete aliases[playerId];

    await writeFile(aliasPath, `${JSON.stringify(aliases, null, 2)}\n`, 'utf8');
  });

  return writeQueue;
}
