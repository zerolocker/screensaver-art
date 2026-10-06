// Every museum whose own images we use, by source key. The Commons lane
// (commons.mjs) defers to them: a work they release comes from them.

import { getty } from './getty.mjs'
import { nga } from './nga.mjs'
import { rijks } from './rijks.mjs'
import { smk } from './smk.mjs'
import { SOURCES } from './sources.mjs'

export const MUSEUMS = { ...SOURCES, nga, rijks, getty, smk }
