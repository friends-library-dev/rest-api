import '@friends-library/env/load';
import env from '@friends-library/env';
import { Lang } from '@friends-library/types';
import { allPublishedAudiobooks } from '@friends-library/friends/query';
import * as docMeta from '@friends-library/document-meta';
import { RouteGenerator } from '../types.internal';

export interface Resource {
  id: string;
  date: string;
  title: string;
  friend: string;
  friendSort: string;
  reader: string;
  artwork: string;
  description: string;
  shortDescription: string;
  parts: Array<{
    audioId: string;
    index: number;
    title: string;
    duration: number;
    size: number;
    sizeLq: number;
    url: string;
    urlLq: string;
  }>;
}

export type Route = Array<Resource>;

const generate: RouteGenerator<Route> = async () => {
  const meta = await docMeta.fetchSingleton();
  const resourcesEn = appAudios(`en`, meta);
  const resourcesEs = appAudios(`es`, meta);
  return {
    'app-audios/v1/en': resourcesEn,
    'app-audios/latest/en': resourcesEn,
    'app-audios/v1/es': resourcesEs,
    'app-audios/latest/es': resourcesEs,
  };
};

export default generate;

function appAudios(lang: Lang, meta: docMeta.DocumentMeta): Route {
  const CLOUD_URL = env.requireVar(`CLOUD_STORAGE_BUCKET_URL`);
  return allPublishedAudiobooks(lang).map((edition) => {
    const { audio, document: doc } = edition;
    const { friend } = doc;
    if (!audio) throw new Error(`Missing audio`);
    const edMeta = meta.get(edition.path);
    if (!edMeta) throw new Error(`Missing edition meta for ${edition.path}`);
    const audioMeta = edMeta.audio;
    if (!audioMeta) throw new Error(`Missing audio metadata for ${edition.path}`);
    return {
      id: `${doc.id}--${edition.type}`,
      date: audio.added.toString(),
      title: doc.title,
      friend: friend.name,
      friendSort: friend.alphabeticalName,
      reader: audio.reader,
      artwork: `${CLOUD_URL}/${edition.squareCoverImagePath(1400)}`,
      description: doc.description,
      shortDescription: doc.partialDescription || doc.description,
      parts: audio.parts.map((part, index) => ({
        audioId: `${doc.id}--${edition.type}`,
        index,
        title: part.title,
        duration: audioMeta.durations[index] ?? 0,
        size: audioMeta.HQ.parts[index]?.mp3Size ?? 0,
        sizeLq: audioMeta.LQ.parts[index]?.mp3Size ?? 0,
        url: `${CLOUD_URL}/${audio.partFilepath(index, `HQ`)}`,
        urlLq: `${CLOUD_URL}/${audio.partFilepath(index, `LQ`)}`,
      })),
    };
  });
}
