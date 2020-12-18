import '@friends-library/env/load';
import env from '@friends-library/env';
import { Handler, APIGatewayEvent } from 'aws-lambda';
import { jsFriendMap } from '@friends-library/friends';
import { allPublishedAudiobooks, setResolveMap } from '@friends-library/friends/query';
import * as docMeta from '@friends-library/document-meta';

interface Audio {
  id: string;
  date: string;
  title: string;
  friend: string;
  friendSort: string;
  reader: string;
  artwork: string;
  description: string;
  shortDescription: string;
  parts: {
    audioId: string;
    index: number;
    title: string;
    duration: number;
    size: number;
    sizeLq: number;
    url: string;
    urlLq: string;
  }[];
}

const handler: Handler = async (event: APIGatewayEvent) => {
  setResolveMap(jsFriendMap);
  const meta = await docMeta.fetchSingleton();
  const { CLOUD_STORAGE_BUCKET_URL: CLOUD_URL } = env.require(`CLOUD_STORAGE_BUCKET_URL`);
  const lang = event.queryStringParameters?.lang === `es` ? `es` : `en`;
  const audioResources: Audio[] = [];
  allPublishedAudiobooks(lang).forEach((edition) => {
    const { audio, document: doc } = edition;
    const { friend } = doc;
    if (!audio) throw new Error(`Missing audio`);
    const edMeta = meta.get(edition.path);
    if (!edMeta) throw new Error(`Missing edition meta for ${edition.path}`);
    const audioMeta = edMeta.audio;
    if (!audioMeta) throw new Error(`Missing audio metadata for ${edition.path}`);
    audioResources.push({
      id: `${doc.id}--${edition.type}`,
      date: audio.added.toString(),
      title: doc.title,
      friend: friend.name,
      friendSort: friend.alphabeticalName,
      reader: audio.reader,
      artwork: `${CLOUD_URL}/${audio.imagePath}`,
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
    });
  });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': `application/json`,
      'Access-Control-Allow-Origin': `*`,
      'Access-Control-Allow-Headers': `*`,
    },
    body: JSON.stringify(audioResources),
  };
};

export { handler };
