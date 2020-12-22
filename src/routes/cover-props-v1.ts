import { isDefined } from 'x-ts-utils';
import { Edition } from '@friends-library/friends';
import { getAllFriends } from '@friends-library/friends/query';
import { CoverProps } from '@friends-library/types';
import * as docMeta from '@friends-library/document-meta';
import fetch from 'node-fetch';
import { RouteGenerator } from '../types.internal';

export type Resource = CoverProps;
export type Route = Resource;

const generate: RouteGenerator<Route> = async () => {
  const meta = await docMeta.fetch();
  const editions = [...getAllFriends(`en`, true), ...getAllFriends(`es`, true)]
    .flatMap((friend) => friend.documents)
    .flatMap((doc) => doc.editions);
  const routePairs = await Promise.all(editions.map((e) => getRoute(e, meta)));
  const routes: Record<string, Route> = {};
  for (const [path, route] of routePairs.filter(isDefined)) {
    routes[`cover-props/v1/${path}`] = route;
    routes[`cover-props/latest/${path}`] = route;
  }
  return routes;
};

export default generate;

async function getRoute(
  edition: Edition,
  meta: docMeta.DocumentMeta,
): Promise<[path: string, coverProps: CoverProps] | undefined> {
  const doc = edition.document;
  const friend = doc.friend;
  const lang = friend.lang;
  const edMeta = meta.get(edition.path);
  if (!edMeta) {
    if (edition.isDraft) return undefined;
    console.error(`missing edition meta for ${edition.path}`);
    process.exit(1);
  }

  const customCode: [string, string] = [``, ``];
  const org = lang === `en` ? `friends-library` : `biblioteca-de-los-amigos`;
  const endpoint = `https://raw.githubusercontent.com`;
  const codeUri = `${endpoint}/${org}/${friend.slug}/master/${doc.slug}`;

  for (const type of [`html`, `css`]) {
    try {
      const res = await fetch(`${codeUri}/paperback-cover.${type}`);
      if (res.status === 200) {
        customCode[type === `css` ? 0 : 1] = await res.text();
      }
    } catch (e) {
      // ¯\_(ツ)_/¯
    }
  }

  return [
    edition.path,
    {
      lang,
      title: doc.title,
      isCompilation: doc.isCompilation,
      author: friend.name,
      pages: edMeta.paperback.volumes[0] || 200,
      size: edMeta.paperback.size,
      edition: edition.type,
      isbn: edition.isbn,
      blurb: doc.description,
      customCss: customCode[0],
      customHtml: customCode[1],
    },
  ];
}
