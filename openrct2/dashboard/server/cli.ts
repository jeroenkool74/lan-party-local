// Operator CLI, run inside the dashboard container (see scripts/admin.sh, scripts/backup.sh).
// Unlike the public HTTP API it shows full public-key hashes.
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';

const dbPath = process.env.DB_PATH ?? '/data/stats.sqlite';
const [cmd, ...args] = process.argv.slice(2);

function open(readOnly = true): DatabaseSync {
  if (!existsSync(dbPath)) {
    console.error(`no database at ${dbPath} yet (has the server sent statistics?)`);
    process.exit(2);
  }
  return new DatabaseSync(dbPath, { readOnly });
}

interface Row { hash: string; name: string; last_seen: number | null; group_name: string | null; is_admin: number }
const fmt = (ms: number | null) => (ms ? new Date(ms).toISOString().replace('T', ' ').slice(0, 19) : 'never online');

switch (cmd) {
  case 'players': {
    const rows = open().prepare('SELECT hash, name, last_seen, group_name, is_admin FROM players ORDER BY name COLLATE NOCASE').all() as unknown as Row[];
    if (args.includes('--json')) {
      console.log(JSON.stringify(rows));
      break;
    }
    if (rows.length === 0) console.log('no players recorded yet');
    for (const r of rows) {
      console.log(`${r.name.padEnd(24)} ${r.hash}  last seen: ${fmt(r.last_seen)}  group: ${r.group_name ?? '-'}${r.is_admin ? ' (admin)' : ''}`);
    }
    break;
  }
  case 'find': {
    const name = args.filter((a) => a !== '--json').join(' ');
    if (!name) { console.error('usage: find <player name>'); process.exit(1); }
    const rows = open().prepare('SELECT hash, name, last_seen, group_name, is_admin FROM players WHERE name = ? COLLATE NOCASE').all(name) as unknown as Row[];
    console.log(JSON.stringify(rows));
    break;
  }
  case 'resolve': {
    // name or 40-hex hash -> "hash<TAB>name" (exit 3 = unknown, 4 = ambiguous)
    const arg = args.join(' ').trim();
    if (!arg) { console.error('usage: resolve <name|hash>'); process.exit(1); }
    const db = open();
    if (/^[0-9a-fA-F]{40}$/.test(arg)) {
      const hash = arg.toLowerCase();
      const row = db.prepare('SELECT name FROM players WHERE hash = ?').get(hash) as { name: string } | undefined;
      console.log(`${hash}\t${row?.name ?? ''}`);
      break;
    }
    const rows = db.prepare('SELECT hash, name, last_seen, group_name, is_admin FROM players WHERE name = ? COLLATE NOCASE').all(arg) as unknown as Row[];
    if (rows.length === 0) {
      console.error(`no player called '${arg}' has been seen yet. Join the server once with that name, or pass the key hash (README: "Becoming administrator").`);
      process.exit(3);
    }
    if (rows.length > 1) {
      console.error(`several keys have used the name '${arg}':`);
      for (const r of rows) console.error(`  ${r.hash}  last seen ${fmt(r.last_seen)}`);
      console.error('run again with the hash of the right one');
      process.exit(4);
    }
    console.log(`${rows[0].hash}\t${rows[0].name}`);
    break;
  }
  case 'snapshot-db': {
    const target = args[0];
    if (!target) { console.error('usage: snapshot-db <file>'); process.exit(1); }
    if (existsSync(target)) { console.error(`${target} already exists`); process.exit(1); }
    open(false).exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    console.log(`database copied to ${target}`);
    break;
  }
  default:
    console.error('commands: players [--json] | find <name> | resolve <name|hash> | snapshot-db <file>');
    process.exit(1);
}
