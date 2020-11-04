// @ts-check
require(`@friends-library/env/load`);
const env = require(`@friends-library/env`).default;
const { getAllFriends } = require(`@friends-library/friends`);
const docMeta = require(`@friends-library/document-meta`);

exports.handler = async function (event) {
  const meta = await docMeta.fetchSingleton();
  const { CLOUD_STORAGE_BUCKET_URL: CLOUD_URL } = env.require(`CLOUD_STORAGE_BUCKET_URL`);
  const lang = event.queryStringParameters.lang === `es` ? `es` : `en`;
  const friends = getAllFriends(lang, true);
  const audios = [];
  friends.forEach((friend) => {
    friend.documents.forEach((doc) => {
      doc.editions.forEach((edition) => {
        if (edition.isDraft) return;
        if (!edition.audio) return;
        const edMeta = meta.get(edition.path);
        if (!edMeta) throw new Error(`Missing edition meta for ${edition.path}`);
        const { audio } = edition;
        audios.push({
          id: `${doc.id}--${edition.type}`,
          date: audio.added,
          title: doc.title,
          friend: friend.name,
          reader: audio.reader,
          artwork: `${CLOUD_URL}/${audio.imagePath}`,
          description: doc.description,
          shortDescription: doc.partialDescription,
          parts: audio.parts.map((part, index) => ({
            audioId: `${doc.id}--${edition.type}`,
            index,
            title: part.title,
            duration: edMeta.audio.durations[index],
            size: edMeta.audio.HQ.parts[index].mp3Size,
            sizeLq: edMeta.audio.LQ.parts[index].mp3Size,
            url: `${CLOUD_URL}/${audio.partFilepath(index, `HQ`)}`,
            urlLq: `${CLOUD_URL}/${audio.partFilepath(index, `LQ`)}`,
          })),
        });
      });
    });
  });
  return {
    statusCode: 200,
    headers: {
      'Content-Type': `application/json`,
      'Access-Control-Allow-Origin': `*`,
      'Access-Control-Allow-Headers': `*`,
    },
    body: JSON.stringify(audios),
  };
};
