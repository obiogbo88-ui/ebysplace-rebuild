import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const edits = [
  ['client/src/pages/Booking.tsx', 'serif mt-4 text-5xl font-bold md:text-6xl', 'serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl'],
  ['client/src/pages/TryOn.tsx', 'serif mt-4 max-w-5xl text-5xl font-bold text-[#2f2418] md:text-6xl', 'serif mt-4 max-w-5xl text-4xl font-bold leading-tight text-[#2f2418] sm:text-5xl md:text-6xl'],
  ['client/src/pages/Braiders.tsx', 'serif mt-4 text-6xl font-bold', 'serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl'],
  ['client/src/pages/Gallery.tsx', 'serif mt-4 text-5xl font-bold md:text-6xl', 'serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl'],
  ['client/src/pages/Reviews.tsx', 'serif mt-4 text-6xl font-bold', 'serif mt-4 text-4xl font-bold leading-tight sm:text-5xl md:text-6xl'],
  ['client/src/pages/Admin.tsx', 'serif mt-3 text-5xl font-bold gold-text', 'serif mt-3 text-4xl font-bold leading-tight gold-text sm:text-5xl'],
];

for (const [relativePath, find, replace] of edits) {
  const file = path.join(root, relativePath);
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes(find)) {
    console.log(`SKIP ${relativePath}: pattern not found`);
    continue;
  }
  src = src.replace(find, replace);
  fs.writeFileSync(file, src);
  console.log(`UPDATED ${relativePath}`);
}
