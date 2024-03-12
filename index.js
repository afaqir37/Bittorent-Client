
'use strict';

import { getPeers } from './src/tracker.js';
import { open } from './src/torrent-parser.js';
import { downloadTorrent } from './src/download.js';

// const tracker = require('./tracker');
// const torrentParser = require('./torrent-parser');

const torrent = open(process.argv[2]);
console.log(torrent.info.pieces.length);

getPeers(torrent, peers => {
    console.log("peers: ", peers);
})

downloadTorrent(torrent, torrent.info.name);