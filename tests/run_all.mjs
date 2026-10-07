import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const {scripts}=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
const suites=Object.entries(scripts).filter(([name])=>/^test:(?:batch\d+|asset-security|upgrade-main)$/.test(name)).sort(([a],[b])=>a.localeCompare(b));
let assertions=0;
for(const [name,command] of suites){
  const files=[...command.matchAll(/node (tests\/[A-Za-z0-9_]+\.mjs)/g)].map(match=>match[1]);
  if(!files.length)throw new Error(`${name} has no test file`);
  let count=0;
  for(const file of files){
    const result=spawnSync(process.execPath,[file],{encoding:'utf8'});
    count+=(result.stdout.match(/^PASS /gm)||[]).length;
    if(result.status!==0){
      console.error(`${name} failed in ${file}\n${result.stdout}\n${result.stderr}`);
      process.exit(result.status||1);
    }
  }
  assertions+=count;
  console.log(`${name}: PASS (${count} assertions)`);
}
console.log(`ALL_TESTS_PASS suites=${suites.length} assertions=${assertions}`);
