import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function wrapBetterSqlite3(database) {
  const wrapper = {
    driver: 'better-sqlite3',
    all(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    get(sql, params = []) {
      return database.prepare(sql).get(...params) ?? null;
    },
    run(sql, params = []) {
      const result = database.prepare(sql).run(...params);
      return {
        changes: result.changes ?? 0,
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
      };
    },
    exec(sql) {
      return database.exec(sql);
    },
    transaction(callback) {
      const wrapped = database.transaction(() => callback(wrapper));
      return wrapped();
    },
    close() {
      database.close();
    },
  };
  return wrapper;
}

function wrapNodeSqlite(database) {
  const wrapper = {
    driver: 'node:sqlite',
    all(sql, params = []) {
      return database.prepare(sql).all(...params);
    },
    get(sql, params = []) {
      return database.prepare(sql).get(...params) ?? null;
    },
    run(sql, params = []) {
      const result = database.prepare(sql).run(...params);
      return {
        changes: result.changes ?? 0,
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
      };
    },
    exec(sql) {
      return database.exec(sql);
    },
    transaction(callback) {
      database.exec('BEGIN');
      try {
        const result = callback(wrapper);
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      database.close();
    },
  };
  return wrapper;
}

export function openDatabase(filePath) {
  try {
    const BetterSqlite3 = require('better-sqlite3');
    const database = new BetterSqlite3(filePath);
    database.pragma('foreign_keys = ON');
    database.pragma('journal_mode = WAL');
    database.pragma('busy_timeout = 5000');
    return wrapBetterSqlite3(database);
  } catch {
    const { DatabaseSync } = require('node:sqlite');
    const database = new DatabaseSync(filePath);
    database.exec('PRAGMA foreign_keys = ON');
    database.exec('PRAGMA journal_mode = WAL');
    database.exec('PRAGMA busy_timeout = 5000');
    return wrapNodeSqlite(database);
  }
}
