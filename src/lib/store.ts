import "server-only";
import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import {RunSnapshot} from "./domain";

let database:Database.Database|undefined;
export function getDatabase(){
  if(database)return database;
  const dataDir=path.join(process.cwd(),"data");
  fs.mkdirSync(dataDir,{recursive:true});
  const dbPath=process.env.RECOVERAI_DB??path.join(dataDir,"recoverai.sqlite");
  fs.mkdirSync(path.dirname(path.resolve(dbPath)),{recursive:true});
  database=new Database(dbPath);
  database.pragma("busy_timeout = 5000");
  database.exec("CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, snapshot_json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, case_id TEXT NOT NULL, version INTEGER NOT NULL, hash TEXT NOT NULL, payload_json TEXT NOT NULL); CREATE UNIQUE INDEX IF NOT EXISTS idempotent_event ON audit_events(id);");
  return database;
}
export const repository={
  save(run:RunSnapshot){const db=getDatabase();const tx=db.transaction(()=>{db.prepare("INSERT OR REPLACE INTO runs VALUES (?,?,?)").run(run.id,new Date().toISOString(),JSON.stringify(run));const insert=db.prepare("INSERT OR IGNORE INTO audit_events VALUES (?,?,?,?,?,?)");for(const result of [...run.ai,...run.baseline])for(const e of result.events)insert.run(e.id,run.id,e.caseId,e.version,e.hash,JSON.stringify(e))});tx()},
  get(id:string){const row=getDatabase().prepare("SELECT snapshot_json FROM runs WHERE id=?").get(id) as {snapshot_json:string}|undefined;return row?JSON.parse(row.snapshot_json) as RunSnapshot:null},
  latest(){const row=getDatabase().prepare("SELECT snapshot_json FROM runs ORDER BY created_at DESC LIMIT 1").get() as {snapshot_json:string}|undefined;return row?JSON.parse(row.snapshot_json) as RunSnapshot:null}
};

