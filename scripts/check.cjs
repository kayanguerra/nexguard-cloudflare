
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
for(const file of ['assets/js/main.js','assets/js/business.js','functions/api/config.js','functions/api/request.js','server/request.mjs','server/response.mjs','scripts/build.cjs'])execFileSync(process.execPath,['--check',file]);
const html=fs.readFileSync('index.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'IDs duplicados');
for(const m of html.matchAll(/(?:href|src)="#([^"]+)"/g))assert(ids.includes(m[1]),'Âncora ausente: '+m[1]);
for(const m of html.matchAll(/(?:href|src)="(assets\/[^"]+)"/g))assert(fs.existsSync(m[1]),'Arquivo ausente: '+m[1]);
for(const m of html.matchAll(/<label for="([^"]+)"/g))assert(ids.includes(m[1]),'Label sem campo');
assert(!/24\/7|1 dia útil|monitoradas continuamente|Defesa ativa|Backup e continuidade|Proteção contra ameaças/.test(html),'Promessa antiga');
assert.equal((html.match(/<h1>/g)||[]).length,1);
assert.equal((html.match(/class="card reveal"/g)||[]).length,6);
assert.equal((html.match(/<details>\s*<summary>/g)||[]).length,11);
console.log('Sintaxe, IDs, âncoras, arquivos locais, labels, catálogo, FAQs e conteúdo: OK.');
