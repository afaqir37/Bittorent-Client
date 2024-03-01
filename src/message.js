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
};

export const buildKeepAlive = () => Buffer.alloc(4);

export const buildChoke = () => {
    const buff = Buffer.alloc(5);

    // length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(0, 4);
    return buff;
};

export const buildUnchoke = () => {
    const buff = Buffer.alloc(5);

    // length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(1, 0);
    return buff;
};

export const buildInterested = () => {
    const buff = Buffer.alloc(5);

    // Length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(2, 0);
    return buff;
};

export const buildNotinterested = () => {
    const buff = Buffer.alloc(5);

    // Length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(3, 0);
    return buff;
};

export const buildHave = payload => {
    const buff = Buffer.alloc(9);

    // length
    buff.writeUInt32BE(5, 0);
    // Id
    buff.writeUInt8BE(4, 4);
    // piece index
    buff.writeUInt32BE(payload, 5);
    return buff;
};

export const buildBitfield = bitfield => {
    const buf = Buffer.alloc(bitfield.length + 5);
    // length
    buf.writeUInt32BE(bitfield.length + 1, 0);
    // id
    buf.writeUInt8(5, 4);
    // bitfield
    bitfield.copy(buf, 5);
    return buf;
};


export const buildRequest = payload => {
    const buf = Buffer.alloc(17);
    // length
    buf.writeUInt32BE(13, 0);
    // id
    buf.writeUInt8(6, 4);
    // piece index
    buf.writeUInt32BE(payload.index, 5);
    // begin
    buf.writeUInt32BE(payload.begin, 9);
    // length
    buf.writeUInt32BE(payload.length, 13);
    return buf;
  };

export const buildPiece = payload => {
    const buf = Buffer.alloc(payload.block.length + 13);
    // length
    buf.writeUInt32BE(payload.block.length + 9, 0);
    // id
    buf.writeUInt8(7, 4);
    // piece index
    buf.writeUInt32BE(payload.index, 5);
    // begin
    buf.writeUInt32BE(payload.begin, 9);
    // block
    payload.block.copy(buf, 13);
    return buf;
  };
  
  
export const buildCancel = payload => {
    const buf = Buffer.alloc(17);
    // length
    buf.writeUInt32BE(13, 0);
    // id
    buf.writeUInt8(8, 4);
    // piece index
    buf.writeUInt32BE(payload.index, 5);
    // begin
    buf.writeUInt32BE(payload.begin, 9);
    // length
    buf.writeUInt32BE(payload.length, 13);
    return buf;
  };

export const buildPort = payload => {
    const buf = Buffer.alloc(7);
    // length
    buf.writeUInt32BE(3, 0);
    // id
    buf.writeUInt8(9, 4);
    // listen-port
    buf.writeUInt16BE(payload, 5);
    return buf;
  };
