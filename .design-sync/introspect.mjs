import { Project, Node, ts } from 'ts-morph';
import { readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const WEB = '/Users/gavinkaiber/git/screensaver-art/living-art-screensaver-web/components/ui';
const files = readdirSync(WEB).filter(f => f.endsWith('.tsx'));
const project = new Project({ skipAddingFilesFromTsConfig:true, compilerOptions:{ jsx: ts.JsxEmit.Preserve, allowJs:true, skipLibCheck:true }});
const byName = new Map(); // exportName -> [file]
const perFile = {};
for (const f of files) {
  const sf = project.addSourceFileAtPath(join(WEB,f));
  const pas = [];
  for (const [name, decls] of sf.getExportedDeclarations()) {
    const real = name === 'default' ? decls.map(d=>d.getName?.()).find(n=>n&&n!=='default') : name;
    if (!real || !/^[A-Z][A-Za-z0-9]*$/.test(real)) continue;
    if (decls.some(d=>Node.isVariableDeclaration(d)||Node.isFunctionDeclaration(d)||Node.isClassDeclaration(d))) {
      pas.push(real);
      byName.set(real, [...(byName.get(real)||[]), f]);
    }
  }
  perFile[f] = pas;
}
// primary = PascalCase of filename if present
const pascal = s => s.replace(/\.tsx$/,'').split(/[-_]/).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
console.log('=== primary export check (filename->PascalName present?) ===');
for (const f of files) {
  const p = pascal(f);
  const has = perFile[f].includes(p);
  console.log(`${has?'OK ':'?? '} ${f.padEnd(22)} -> ${p.padEnd(22)} ${has?'':'exports: '+perFile[f].join(', ')}`);
}
console.log('\n=== cross-file name collisions (same export in >1 file) ===');
for (const [n, fs] of byName) if (fs.length>1) console.log(`${n}: ${fs.join(', ')}`);
