import '@friends-library/env/load';
import env from '@friends-library/env';
import {
  EditionType,
  Lang,
  SquareCoverImageSize,
  SQUARE_COVER_IMAGE_SIZES,
} from '@friends-library/types';
import { allPublishedEditions } from '@friends-library/friends/query';
import * as docMeta from '@friends-library/document-meta';
import { RouteGenerator } from '../types.internal';
import { evaluate, ParserError } from '@friends-library/evaluator';
import { query, hydrate } from '@friends-library/dpc-fs';

export interface Resource {
  id: string;
  documentId: string;
  revision: string;
  type: EditionType;
  publishedDate: string;
  documentTitle: string;
  friendName: string;
  friendNameSort: string;
  url: string;
  documentDescription: string;
  documentShortDescription: string;
  numTotalPaperbackPages: number;
  isMostModernized: boolean;
  images: Array<{ size: SquareCoverImageSize; url: string }>;
  chapters: Array<{ shortTitle: string }>;
}

export type Route = Array<Resource>;

const generate: RouteGenerator<Route> = async () => {
  const meta = await docMeta.fetchSingleton();
  const enResources = editions(`en`, meta);
  const esResources = editions(`es`, meta);
  return {
    'app-editions/v1/en': enResources,
    'app-editions/latest/en': enResources,
    'app-editions/v1/es': esResources,
    'app-editions/latest/es': esResources,
  };
};

export default generate;

function editions(lang: Lang, meta: docMeta.DocumentMeta): Route {
  const CLOUD_URL = env.requireVar(`CLOUD_STORAGE_BUCKET_URL`);
  return allPublishedEditions(lang).map((edition) => {
    const document = edition.document;
    const edMeta = meta.get(edition.path);
    if (!edMeta) throw new Error(`Missing edition meta for ${edition.path}`);

    const [dpc] = query.getByPattern(edition.path);
    if (!dpc) throw new Error(`Missing dpc for ${edition.path}`);
    hydrate.asciidoc(dpc, { chapterHeadingsOnly: false });

    try {
      var evald = evaluate.toPdfSrcHtml(dpc);
    } catch (err) {
      if (err instanceof ParserError) {
        console.log(err.codeFrame);
        process.exit(1);
      } else {
        throw err;
      }
    }

    return {
      id: `${document.id}--${edition.type}`,
      documentId: document.id,
      type: edition.type,
      url: `${CLOUD_URL}/${dpc.path}/${edition.filename(`app-ebook`)}`,
      publishedDate: edMeta.published,
      documentTitle: document.title,
      friendName: document.friend.name,
      friendNameSort: document.friend.alphabeticalName,
      documentDescription: document.description,
      documentShortDescription: document.partialDescription ?? document.description,
      numTotalPaperbackPages: edMeta.paperback.volumes.reduce((acc, vol) => acc + vol),
      isMostModernized: edition.isMostModernized,
      revision: edMeta.revision,
      chapters: evald.chapters.map((ch) => ({
        shortTitle: ch.shortHeading,
      })),
      images: SQUARE_COVER_IMAGE_SIZES.map((size) => ({
        size,
        url: `${CLOUD_URL}/${edition.squareCoverImagePath(size)}`,
      })),
    };
  });
}
