import fs from 'node:fs';
import { validatePriceFeed, MAX_FEED_BYTES } from '../../src/addons/perf/pricing-live.js';
const raw = fs.readFileSync(process.argv[2]);
if (raw.byteLength > MAX_FEED_BYTES) throw new Error('Feed too large');
const feed = validatePriceFeed(JSON.parse(raw));
console.log(`Validated ${Object.keys(feed.providers).length} providers`);
