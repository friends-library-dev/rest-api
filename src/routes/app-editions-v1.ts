import '@friends-library/env/load';
import env from '@friends-library/env';
import { utf8ShortTitle } from '@friends-library/adoc-utils';
import {
  Lang,
  EditionType,
  SquareCoverImageSize,
  ThreeDCoverImageWidth,
  SQUARE_COVER_IMAGE_SIZES,
  THREE_D_COVER_IMAGE_WIDTHS,
  THREE_D_COVER_IMAGE_ASPECT_RATIO,
} from '@friends-library/types';
import { allPublishedEditions } from '@friends-library/friends/query';
import * as docMeta from '@friends-library/document-meta';
import { evaluate, ParserError, PdfSrcResult } from '@friends-library/evaluator';
import { query, hydrate, FsDocPrecursor } from '@friends-library/dpc-fs';
import { RouteGenerator } from '../types.internal';
import { Document, Edition } from '@friends-library/friends';

export interface Resource {
  id: string;
  lang: Lang;
  document: {
    id: string;
    title: string;
    utf8ShortTitle: string;
    trimmedUtf8ShortTitle: string;
    description: string;
    shortDescription: string;
  };
  revision: string;
  type: EditionType;
  publishedDate: string;
  friend: {
    name: string;
    nameSort: string;
    isCompilations: boolean;
  };
  ebook: {
    loggedDownloadUrl: string;
    directDownloadUrl: string;
    numPages: number;
  };
  isMostModernized: boolean;
  audio: null | {
    reader: string;
    totalDuration: number;
    publishedDate: string;
    parts: Array<{
      editionId: string;
      index: number;
      title: string;
      utf8ShortTitle: string;
      duration: number;
      size: number;
      sizeLq: number;
      url: string;
      urlLq: string;
    }>;
  };
  images: {
    square: Array<{
      width: SquareCoverImageSize;
      height: SquareCoverImageSize;
      url: string;
    }>;
    threeD: Array<{
      width: ThreeDCoverImageWidth;
      height: number;
      url: string;
    }>;
  };
  chapters: Array<{
    index: number;
    id: string;
    slug: string;
    shortHeading: string;
    isIntermediateTitle: boolean;
    isSequenced: boolean;
    hasNonSequenceTitle: boolean;
    sequenceNumber: number | null;
    nonSequenceTitle: string | null;
  }>;
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
    const [dpc, document, edMeta] = derive(edition, meta);
    return {
      id: `${document.id}--${edition.type}`,
      lang,
      document: {
        id: document.id,
        title: document.title,
        utf8ShortTitle: utf8ShortTitle(document.title),
        trimmedUtf8ShortTitle: trimmedUtf8ShortDocumentTitle(document.title),
        description: document.description,
        shortDescription: document.partialDescription ?? document.description,
      },
      type: edition.type,
      ebook: {
        loggedDownloadUrl: ebookHtmlLoggedDownloadUrl(dpc, edition),
        directDownloadUrl: `${CLOUD_URL}/${dpc.path}/${edition.filename(`app-ebook`)}`,
        numPages: numPages(edMeta),
      },
      publishedDate: edMeta.published,
      friend: {
        name: document.friend.name,
        nameSort: document.friend.alphabeticalName,
        isCompilations: document.friend.isCompilationsQuasiFriend,
      },
      isMostModernized: edition.isMostModernized,
      revision: edMeta.revision,
      audio: edition.audio
        ? {
            reader: edition.audio.reader,
            totalDuration: edMeta.audio!.durations.reduce((acc, d) => acc + d),
            publishedDate: edition.audio.added.toString(),
            parts: edition.audio.parts.map((part, index) => ({
              index,
              editionId: `${document.id}--${edition.type}`,
              title: part.title,
              utf8ShortTitle: utf8ShortTitle(part.title),
              duration: edMeta.audio!.durations[index] ?? 0,
              size: edMeta.audio!.HQ.parts[index]?.mp3Size ?? 0,
              sizeLq: edMeta.audio!.LQ.parts[index]?.mp3Size ?? 0,
              url: `${CLOUD_URL}/${edition.audio!.partFilepath(index, `HQ`)}`,
              urlLq: `${CLOUD_URL}/${edition.audio!.partFilepath(index, `LQ`)}`,
            })),
          }
        : null,
      chapters: getPdfSrcResult(dpc).chapters.map((ch, index) => ({
        index,
        id: ch.id,
        shortHeading: utf8ShortTitle(ch.shortHeading),
        slug: ch.slug,
        isIntermediateTitle: ch.isIntermediateTitle,
        isSequenced: ch.isSequenced,
        hasNonSequenceTitle: ch.hasNonSequenceTitle,
        sequenceNumber: ch.sequenceNumber ?? null,
        nonSequenceTitle: ch.nonSequenceTitle ?? null,
      })),
      images: {
        square: SQUARE_COVER_IMAGE_SIZES.map((size) => ({
          width: size,
          height: size,
          url: `${CLOUD_URL}/${edition.squareCoverImagePath(size)}`,
        })),
        threeD: THREE_D_COVER_IMAGE_WIDTHS.map((width) => ({
          width,
          height: Math.floor(width / THREE_D_COVER_IMAGE_ASPECT_RATIO),
          url: `${CLOUD_URL}/${edition.threeDCoverImagePath(width)}`,
        })),
      },
    };
  });
}

function derive(
  edition: Edition,
  meta: docMeta.DocumentMeta,
): [FsDocPrecursor, Document, docMeta.EditionMeta] {
  const [dpc] = query.getByPattern(edition.path);
  const document = edition.document;
  const edMeta = meta.get(edition.path);
  if (!edMeta) {
    throw new Error(`Missing edition meta for ${edition.path}`);
  }

  if (edition.audio && !edMeta.audio) {
    throw new Error(`Missing audio meta for ${edition.path}`);
  }

  if (!dpc) {
    throw new Error(`Missing dpc for ${edition.path}`);
  }

  return [dpc, document, edMeta];
}

// @TODO duplication, see `uri pkg refactor` task in Things app
function ebookHtmlLoggedDownloadUrl(dpc: FsDocPrecursor, edition: Edition): string {
  return [
    dpc.lang === `en`
      ? `https://www.friendslibrary.com`
      : `https://www.bibliotecadelosamigos.org`,
    `.netlify/functions/site/log/download`,
    edition.document.id,
    edition.path,
    `app-ebook`,
    edition.filename(`app-ebook`),
  ].join(`/`);
}

function getPdfSrcResult(dpc: FsDocPrecursor): PdfSrcResult {
  try {
    hydrate.asciidoc(dpc, { chapterHeadingsOnly: true });
    return evaluate.toPdfSrcHtml(dpc);
  } catch (err) {
    if (err instanceof ParserError) {
      console.log(err.codeFrame);
      process.exit(1);
    } else {
      throw err;
    }
  }
}

function numPages(edMeta: docMeta.EditionMeta): number {
  const pages = edMeta.paperback.pageData.single;
  if (pages.m !== undefined && pages.m !== 0) {
    return pages.m;
  }
  return Math.floor(pages.s * INFER_MED_SIZE_MULTIPLIER);
}

// @TODO TRANSLATION
function trimmedUtf8ShortDocumentTitle(title: string): string {
  return utf8ShortTitle(title)
    .replace(/^(The|A) /, ``)
    .replace(/^Selection from the (.*)/, `$1 (Selection)`);
}

// calculated from real data
const INFER_MED_SIZE_MULTIPLIER = 0.639971767305312;
