import type {ActiveScreenEffectId} from '../shared/vtt-screen-effects';
import posters from '../shared/vtt-screen-previews.json';
import {VttAssetImage} from './VttAssetImage';
export function VttScreenPreview({preset}:{preset:ActiveScreenEffectId}){
  return <VttAssetImage thumbnail src={posters[preset]} width={128} height={96} className="vtt-screen-preview" alt="" aria-hidden="true"/>;
}
