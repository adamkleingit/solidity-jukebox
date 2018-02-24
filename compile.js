const fs = require('fs');
const path = require('path');
const solc = require('solc');

const loterryPath = path.resolve(__dirname, 'contracts', 'jukebox.sol');
const source = fs.readFileSync(loterryPath, 'utf8');
const compiled = solc.compile(source, 1);
module.exports = compiled.contracts[':Jukebox'];
