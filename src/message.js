import { infoHash } from '../torrent-parser.js';
import { genId } from '../util.js';
import { Buffer } from 'buffer';

export const buildHandshake = torrent => {
    const buff = Buffer.alloc(68);

    //pstrlen
    buff.writeUInt8BE(19, 0);

    //pstr
    buff.write('BitTorrent protocol', 1);

    //reserved
    buff.writeUInt32BE(0, 20);
    buff.writeUInt32BE(0, 24);

    //infoHash
    infoHash(torrent).copy(buff, 28);

    // peer id
    buff.write(genId(), 48);

    return buff;
}