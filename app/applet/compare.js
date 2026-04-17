const fs = require('fs');
const path = require('path');

function walkDir(dir, baseDir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    // skip .git, node_modules, etc
    if(file === '.git' || file === 'node_modules' || file === '.monkeycode' || file === 'package-lock.json') return;
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkDir(file, baseDir));
    } else {
      results.push(path.relative(baseDir, file));
    }
  });
  return results;
}

const githubFiles = new Set(walkDir('/tmp/hwdash', '/tmp/hwdash'));
const localFiles = new Set(walkDir('/app/applet', '/app/applet'));

const missingInLocal = [...githubFiles].filter(f => !localFiles.has(f));
const extraInLocal = [...localFiles].filter(f => !githubFiles.has(f));

console.log('Missing in local (exist in github):');
missingInLocal.forEach(f => console.log('  ' + f));

console.log('\nExtra in local (exist locally but not in github):');
extraInLocal.forEach(f => console.log('  ' + f));
