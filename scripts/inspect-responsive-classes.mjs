import fs from 'node:fs';
import path from 'node:path';

const pages = ['Home','Services','Booking','Shop','TryOn','Braiders','Gallery','Reviews','Admin'];
const root = process.cwd();
for (const page of pages) {
  const file = path.join(root, 'client/src/pages', `${page}.tsx`);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  const matches = [...src.matchAll(/className="([^"]*(?:text-[567]xl|grid-cols-\[|lg:grid-cols|md:grid-cols|overflow-x|min-w-0)[^"]*)"/g)];
  console.log(`--- ${page}.tsx`);
  for (const match of matches) console.log(match[1]);
}
