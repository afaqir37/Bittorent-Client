
'use strict';

import { getPeers } from './src/tracker.js';
import { open } from './src/torrent-parser.js';

// const tracker = require('./tracker');
// const torrentParser = require('./torrent-parser');

const torrent = open(process.argv[2]);
console.log(torrent.info);

getPeers(torrent, peers => {
    console.log('list of peers: ', peers);
});