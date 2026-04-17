const fs = require('fs');
const diff = require('child_process').execSync('diff -u /tmp/hwdash/src/App.tsx /app/applet/src/App.tsx || true').toString();
console.log(diff.substring(0, 1000));
