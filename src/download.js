// import net module
import net from 'net';
import { Buffer } from 'buffer';
import { getPeers } from './tracker.js';
import * as message from './message.js';
import { Pieces } from './pieces.js';
import { Queue } from './queue.js';
import fs from 'fs';

export const downloadTorrent = (torrent, path) => {
    const pieces = new Pieces(torrent);
    const file = fs.openSync(path, 'w');
    getPeers(torrent, peers => {
        peers.forEach(peer => download(peer, torrent, pieces, file));
    });
};

function download(peer, torrent, pieces, file) {
    const queue = new Queue(torrent);
    const socket = net.Socket();
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        socket.write(message.buildHandshake(torrent));
    });
    
    onWholeMsg(socket, msg => {
        
        //console.log(queue);
        msgHandler(msg, socket, pieces, queue, torrent, file);});

}

function onWholeMsg(socket, callback) {
    let savedBuf = Buffer.alloc(0);
    let handshake = true;

    socket.on('data', receivedBuf => {
        const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readUInt32BE(0) + 4;
        savedBuf = Buffer.concat([savedBuf, receivedBuf]);

        while(savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
            callback(savedBuf.subarray(0, savedBuf.length));
            savedBuf = savedBuf.subarray(msgLen());
            handshake = false;
        }
    });

}

function isHandshake(msg) {
    return msg.length === msg.readUInt8(0) + 49 &&
           msg.toString('utf8', 1) === 'BitTorrent protocol';
  }

function msgHandler(msg, socket, pieces, queue, torrent, file) {
    if (isHandshake(msg))
        socket.write(message.buildInterested());
    else {
        const m = message.parse(msg);

        if (m.id == 0) chokeHandler(socket);
        if (m.id == 1) unchokeHandler(socket, pieces, queue);
        if (m.id == 4) haveHandler(m.payload, socket, pieces, queue);
        if (m.id == 5) bitfieldHandler(socket, pieces, queue, m.payload);
        if (m.id == 7) pieceHandler(socket, m.payload, pieces, queue, torrent, file);
    }

}

function chokeHandler(socket) {
    socket.end();
}

function unchokeHandler(socket, pieces, queue)
{
    requestPiece(socket, pieces, queue);
}

function haveHandler(payload, socket, pieces, queue) {
    //...
    const pieceIndex = payload.readUInt32BE(0);
    const queueEmpty = queue.length() === 0;
    queue.queue(pieceIndex);
    if (queueEmpty)
        requestPiece(socket, pieces, queue);
}

function bitfieldHandler(socket, pieces, queue, payload) {
    const queueEmpty = queue.length() == 0;
    payload.forEach((byte, i) => {
        for (let j = 0; j < 8; j++) {
            if (byte % 2)
                queue.queue(i * 8 + 7 - j);
            byte = Math.floor(byte / 2);
        }
    });
    if (queueEmpty)
        requestPiece(socket, pieces, queue);
}

function pieceHandler(socket, pieceResp, pieces, queue, torrent, file) {
   pieces.addReceived(pieceResp);
   
   const offset = pieceResp.index * torrent.info['piece length'] + pieceResp.begin;
   fs.write(file, pieceResp.block, 0, pieceResp.block.length, offset, () => {});

   if (pieces.isDone()) {
    console.log('DONE!');
    socket.end();
    try { 
        fs.closeSync(file);
    } catch(e) {}
   } else {
    requestPiece(socket, pieces, queue);
   }
}

function requestPiece(socket, pieces, queue) {
    if (queue.choked)
        return null;

    while (queue.length()) {
        const pieceBlock = queue.deque();
        if (pieces.needed(pieceBlock)) {
            socket.write(message.buildRequest(pieceBlock));
            pieces.addRequested(pieceBlock);
            break;
        }
    }  
}


