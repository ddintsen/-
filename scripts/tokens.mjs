import fs from 'node:fs';
import YAML from 'yaml';
const text = fs.readFileSync('DESIGN.md', 'utf8');
const tokens = YAML.parse(text.split('---')[1]);
const lines = [':root {'];
for (const [key, value] of Object.entries(tokens.colors)) lines.push(`  --color-${key}: ${value};`);
for (const [key, value] of Object.entries(tokens.typography)) lines.push(`  --font-${key}: ${value.fontFamily};`);
for (const [key, value] of Object.entries(tokens.rounded)) lines.push(`  --radius-${key.toLowerCase()}: ${value};`);
for (const [key, value] of Object.entries(tokens.spacing)) lines.push(`  --space-${key}: ${value};`);
lines.push('}', '');
const files = {'src/styles/tokens.css': '/* Generated from DESIGN.md. Run npm run tokens. */\n'+lines.join('\n'), 'src/styles/tokens.json': JSON.stringify({colors:tokens.colors,typography:tokens.typography},null,2)+'\n'};
for(const [path, content] of Object.entries(files)) {
 if(process.argv.includes('--check')) { if(!fs.existsSync(path)||fs.readFileSync(path,'utf8')!==content) throw new Error(`Token drift: ${path}`); }
 else { fs.mkdirSync('src/styles',{recursive:true}); fs.writeFileSync(path,content); }
}
