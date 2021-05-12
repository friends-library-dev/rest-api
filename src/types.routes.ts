import type {
  Resource as CoverPropsResourceV1,
  Route as CoverPropsRouteV1,
} from './routes/cover-props-v1';

import type {
  Resource as AppAudioResourceV1,
  Route as AppAudiosRouteV1,
} from './routes/app-audios-v1';

import type {
  Resource as EditionResourceV1,
  Route as EditionsRouteV1,
} from './routes/editions-v1';

/**
 * @deprecated use `AppAudioResourceV1` instead
 */
type AppAudiosResourceV1 = AppAudioResourceV1;

export {
  AppAudioResourceV1,
  AppAudiosResourceV1,
  AppAudiosRouteV1,
  CoverPropsResourceV1,
  CoverPropsRouteV1,
  EditionResourceV1,
  EditionsRouteV1,
};
