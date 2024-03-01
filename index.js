
'use strict';

import { getPeers } from './tracker.js';
import { open } from './torrent-parser.js';

// const tracker = require('./tracker');
// const torrentParser = require('./torrent-parser');

const torrent = open(process.argv[2]);

getPeers(torrent, peers => {
    console.log('list of peers: ', peers);
});