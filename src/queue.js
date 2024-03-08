'use strict'

import * as parse from './torrent-parser.js';

export const Queue = class {
    #torrent;
    #queue;
    
    constructor(torrent) {
        this.#torrent = torrent;
        this.#queue = [];
        this.choked = true;
    }

    queue(pieceIndex) {
        const nBlocks = parse.blocksPerPiece(this.#torrent, pieceIndex);
        for (let i = 0; i < nBlocks; i++) {
            const pieceBlock = {
                index: pieceIndex,
                begin: i * parse.BLOCK_LEN,
                length: parse.blockLen(this.#torrent, pieceIndex, i)
            };
            this.#queue.push(pieceBlock);
        }
    }

    deque() { return this.#queue.shift(); }

    peek() { return this.#queue[0]; }

    length() { return this.#queue.length; }


};