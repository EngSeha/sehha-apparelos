import {readFileSync} from 'node:fs';import {ok,root} from './test_helpers.mjs';
const pkg=JSON.parse(readFileSync(root+'/package.json','utf8')),worker=readFileSync(root+'/src/worker.js','utf8'),readme=readFileSync(root+'/README_AR.md','utf8');
ok(pkg.version==='0.21.0','package version Preview 21');ok(worker.includes("const SCHEMA_VERSION = '21';")&&worker.includes("const VERSION = '0.21.0-cloudflare';"),'worker schema/version Preview 21');ok(readme.includes('schemaVersion: "21"')&&readme.includes('expectedSchemaVersion: "21"')&&readme.includes('version: "0.21.0-cloudflare"'),'README runtime metadata Preview 21');
console.log('BATCH15_METADATA_PASS');
