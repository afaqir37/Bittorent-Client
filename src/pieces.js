'use strict';

import { BLOCK_LEN, blocksPerPiece, size } from "./torrent-parser";

export const Pieces = class {
    constructor(torrent) {
        function buildPiecesArray() {
            const nPieces = size(torrent) / 20;
            const arr = new Array(nPieces).fill(null);
            return arr.map((_, i) => new Array(blocksPerPiece(torrent, i)).fill(false));
        }

        this.requested = buildPiecesArray();
        this.received = buildPiecesArray();
    }

    addRequested(pieceBlock) {
        const blockIndex = pieceBlock.begin / BLOCK_LEN;
        this.requested[pieceBlock.index][blockIndex] = true;
    }

    addReceived(pieceIndex) {
        const blockIndex = pieceBlock.begin / BLOCK_LEN;
        this.received[pieceBlock.index][blockIndex] = true;
    }

    needed(pieceBlock) {
        if (this.requested.every(blocks => blocks.every(i => i))) {
            this.requested = this.received.map(blocks => blocks.slice());
        }
        const blockIndex = pieceBlock.begin / BLOCK_LEN;
        return !this.requested[pieceBlock.pieceIndex][blockIndex];
    }

    isDone() {
        return this.received.every(blocks => blocks.every(i => i));
    }
};