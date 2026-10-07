import {readFileSync} from 'node:fs';
import {ok,root} from './test_helpers.mjs';
const pkg=JSON.parse(readFileSync(root+'/package.json','utf8')),worker=readFileSync(root+'/src/worker.js','utf8'),readme=readFileSync(root+'/README_AR.md','utf8');
ok(pkg.version==='0.21.0','package version matches Preview 21');
ok(worker.includes("const SCHEMA_VERSION = '18';")&&worker.includes("const VERSION = '0.21.0-cloudflare';"),'worker metadata is schema 17 / v0.21');
ok(readme.includes('schemaVersion: "17"')&&readme.includes('expectedSchemaVersion: "17"')&&readme.includes('version: "0.21.0-cloudflare"'),'README runtime metadata matches code');
ok(readme.includes('Developer Preview 21'),'README title matches Preview 21');
console.log('BATCH14_METADATA_PASS');
