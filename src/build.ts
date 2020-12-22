import fs from 'fs';
import { dirname } from 'path';
import routeGenerators from './routes';

async function main(): Promise<void> {
  const routes: string[] = [];
  const buildDir = `${__dirname}/../build`;
  for (const generator of routeGenerators) {
    const buildMap = await generator();
    for (const [path, routeData] of Object.entries(buildMap)) {
      routes.push(path);
      const buildPath = `${buildDir}/${path}`;
      fs.mkdirSync(dirname(buildPath), { recursive: true });
      fs.writeFileSync(buildPath, JSON.stringify(routeData));
    }
  }
  fs.writeFileSync(`${buildDir}/index.html`, JSON.stringify(routes.map((r) => `/${r}`)));
}

main();
