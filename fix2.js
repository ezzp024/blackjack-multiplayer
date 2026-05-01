const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'public');
const files = ['blackjack.html','profile.html','roulette.html','slots.html'];
files.forEach(f => {
  const p = path.join(dir, f);
  // Read as latin1 to see the raw bytes, then fix
  let c = fs.readFileSync(p, 'utf8');
  // Find all â€ sequences
  const matches = c.match(/â[^a-z]{0,5}/g);
  if (matches) console.log(f, JSON.stringify([...new Set(matches)]));

  // Fix common UTF-8 double-encoded sequences
  c = c.replace(/â€“/g, '—');  // em dash: â€"
  c = c.replace(/â€œ/g, '"');  // left double quote
  c = c.replace(/â€/g, '"');  // right double quote
  c = c.replace(/â€™/g, "'");  // right single quote
  c = c.replace(/â€˜/g, "'");  // left single quote
  // Generic: replace any remaining â€ sequences with em dash
  c = c.replace(/â€[-ÿ]/g, '—');

  fs.writeFileSync(p, c, 'utf8');
  console.log('fixed', f);
});
