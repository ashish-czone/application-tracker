import { registerStarterBlocks, registerContentBlocks } from '@domains/agency-ui/portals/customer';

// Runs exactly once at import time. Imported by the root layout so that
// every SSR/SSG render has the registry populated before PageRenderer
// looks up block kinds. Add your theme's custom blocks below.
registerStarterBlocks();
registerContentBlocks();
