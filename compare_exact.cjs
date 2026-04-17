const fs = require('fs');
const path = require('path');

function walkDir(dir, baseDir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    if(file === '.git' || file === 'node_modules' || file === 'dist' || file === '.monkeycode' || file === 'package-lock.json' || file === '.vscode') return;
    const fullPath = path.resolve(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(walkDir(fullPath, baseDir));
      } else {
        results.push(path.relative(baseDir, fullPath));
      }
    } catch(e){}
  });
  return results;
}

const githubFiles = walkDir('/tmp/hwdash', '/tmp/hwdash');
const localFiles = walkDir('/app/applet', '/app/applet');

const localSet = new Set(localFiles);
const githubSet = new Set(githubFiles);

const missing = githubFiles.filter(f => !localSet.has(f));

console.log('Missing in local:');
missing.forEach(f => console.log(f));
