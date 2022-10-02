// @ts-ignore This is a conditional import
import * as supportRaw from '#support';

import type * as browserType from './browser';

// TODO: this is a bit gross. how does it end up being minified?
const typedSupport = supportRaw as typeof browserType;
export const isDeepStrictEqual = typedSupport.isDeepStrictEqual;
