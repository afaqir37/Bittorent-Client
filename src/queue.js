'use strict'

import * as parse from './torrent-parser.js';

export const Queue = class {
    
    constructor(torrent) {
        this.torrent = torrent;
        this.queueArray = [];
        this.choked = true;
    }

    queue(pieceIndex) {
        const nBlocks = parse.blocksPerPiece(this.torrent, pieceIndex);
        for (let i = 0; i < nBlocks; i++) {
            const pieceBlock = {
                index: pieceIndex,
                begin: i * parse.BLOCK_LEN,
                length: parse.blockLen(this.torrent, pieceIndex, i)
            };
            this.queueArray.push(pieceBlock);
        }
    }

    deque() { return this.queueArray.shift(); }

    peek() { return this.queueArray[0]; }

    length() { return this.queueArray.length; }


};