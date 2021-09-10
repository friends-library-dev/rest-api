import '@friends-library/env/load';
import env from '@friends-library/env';
import { Lang, EditionType, PrintSize } from '@friends-library/types';
import { allPublishedEditions } from '@friends-library/friends/query';
import * as docMeta from '@friends-library/document-meta';
import { price } from '@friends-library/lulu';
import { RouteGenerator } from '../types.internal';
import { editionData, trimmedUtf8ShortDocumentTitle } from './app-editions-v1';

export interface Resource {
  id: string;
  lang: Lang;
  document: {
    id: string;
    title: string;
    trimmedUtf8ShortTitle: string;
  };
  friend: {
    name: string;
  };
  type: EditionType;
  price: number;
  printSize: PrintSize;
  pages: number[];
  image: {
    large: string;
    small: string;
  };
}

export type Route = Array<Resource>;

const generate: RouteGenerator<Route> = async () => {
  const meta = await docMeta.fetchSingleton();
  const resources = [...editions(`en`, meta), ...editions(`es`, meta)];
  return {
    'admin-order-editions/v1': resources,
    'admin-order-editions/latest': resources,
  };
};

export default generate;

function editions(lang: Lang, meta: docMeta.DocumentMeta): Route {
  const CLOUD_URL = env.requireVar(`CLOUD_STORAGE_BUCKET_URL`);
  return allPublishedEditions(lang).map((edition) => {
    const [, document, edMeta] = editionData(edition, meta);
    return {
      id: `${document.id}--${edition.type}`,
      lang,
      document: {
        id: document.id,
        title: document.title,
        trimmedUtf8ShortTitle: trimmedUtf8ShortDocumentTitle(document.title, lang),
      },
      type: edition.type,
      friend: {
        name: document.friend.name,
      },
      price: price(edMeta.paperback.size, edMeta.paperback.volumes),
      pages: edMeta.paperback.volumes,
      printSize: edMeta.paperback.size,
      image: {
        small: `${CLOUD_URL}/${edition.threeDCoverImagePath(55)}`,
        large: `${CLOUD_URL}/${edition.threeDCoverImagePath(110)}`,
      },
    };
  });
}
