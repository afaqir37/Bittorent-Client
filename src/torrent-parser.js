'use strict';

import bencode from 'bencode';
import crypto from 'crypto';
import fs from 'fs';
import bignum from 'bignum';

export const open = (filepath) => {
    return bencode.decode(fs.readFileSync(filepath));
};

export const size = torrent => {
    const size = torrent.info.files ?
        torrent.info.files.map(file => file.length).reduce((a, b) => a + b) :
        torrent.info.length;

    return bignum.toBuffer(size, { size: 8 });
};


export const infoHash = torrent => {
    const info = bencode.encode(torrent.info);
    return crypto.createHash('sha1').update(info).digest();
};

export const BLOCK_LEN = Math.pow(2, 14);

export const pieceLen = (torrent, pieceIndex) => {
    const totalPieceLen = bignum.fromBuffer(size(torrent)).toNumber();
    const pieceLength = torrent.info['piece length']
    const lastPieceLen = totalPieceLen % pieceLength;

    const lastPieceIndex = Math.floor(totalPieceLen / pieceLength);
    return (pieceIndex == lastPieceIndex) ? lastPieceLen : pieceLength;
};

export const blocksPerPiece = (torrent, pieceIndex) => {
    const pieceLength = pieceLen(torrent, pieceIndex);
    return Math.ceil(pieceLength / BLOCK_LEN);
};

export const blockLen = (torrent, pieceIndex, blockIndex) => {
    const pieceLength = pieceLen(torrent, pieceIndex);
    const lastBlockLen = pieceLength % BLOCK_LEN;
    const lastBlockIndex = Math.floor(pieceLength / BLOCK_LEN);

    return (blockIndex == lastBlockIndex) ? lastBlockLen : BLOCK_LEN;
}