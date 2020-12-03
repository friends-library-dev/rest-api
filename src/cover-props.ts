import { Handler, APIGatewayEvent } from 'aws-lambda';
import { setResolveMap, getFriend, jsFriendMap } from '@friends-library/friends';
import { Lang, isEdition, CoverProps } from '@friends-library/types';
import * as docMeta from '@friends-library/document-meta';
import fetch from 'node-fetch';

const handler: Handler = async (event: APIGatewayEvent) => {
  setResolveMap(jsFriendMap);
  const editionPath = event.path.split(`cover-props/`).pop();
  if (!editionPath) {
    return clientError(`bad path`);
  }

  const [rawLang, friendSlug, docSlug, editionType] = editionPath.split(`/`);
  const lang: Lang = rawLang === `es` ? `es` : `en`;
  if (!isEdition(editionType)) {
    return clientError(`bad edition type`);
  }

  try {
    var friend = getFriend(friendSlug, lang);
  } catch (e) {
    return clientError(`unknown friend ${lang}/${friendSlug}`);
  }

  const document = friend.documents.find((d) => d.slug === docSlug);
  if (!document) {
    return clientError(`uknown document ${lang}/${friendSlug}/${docSlug}`);
  }

  const edition = document.editions.find((e) => e.type === editionType);
  if (!edition) {
    return clientError(`uknown edition ${editionPath}`);
  }

  const meta = await docMeta.fetch();
  const edMeta = meta.get(editionPath);
  if (!edMeta) {
    return clientError(`missing edition meta for ${editionPath}`);
  }

  const customCode = [``, ``];
  const org = lang === `en` ? `friends-library` : `biblioteca-de-los-amigos`;
  const endpoint = `https://raw.githubusercontent.com`;
  const codeUri = `${endpoint}/${org}/${friendSlug}/master/${docSlug}`;

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

  const props: CoverProps = {
    lang,
    title: document.title,
    isCompilation: document.isCompilation,
    author: friend.name,
    pages: edMeta.paperback.volumes[0],
    size: edMeta.paperback.size,
    edition: editionType,
    isbn: edition.isbn,
    blurb: document.description,
    customCss: customCode[0],
    customHtml: customCode[1],
  };

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(props),
  };
};

export { handler };

function clientError(
  msg: string,
): { statusCode: number; headers: Record<string, string>; body: string } {
  return {
    statusCode: 400,
    headers: CORS_HEADERS,
    body: JSON.stringify({ errorMsg: msg }),
  };
}

const CORS_HEADERS = {
  'Content-Type': `application/json`,
  'Access-Control-Allow-Origin': `*`,
  'Access-Control-Allow-Headers': `*`,
};
