// import net module
import net from 'net';
import { Buffer } from 'buffer';
import { getPeers } from './tracker.js';
import * as message from './message.js';

export const downloadTorrent = torrent => {
    const requested = [];
    getPeers(torrent, peers => {
        peers.forEach(peer => download(peer, torrent, requested));
    });
};

function download(peer, torrent, requested) {
    const queue = [];
    const socket = net.Socket();
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        socket.write(message.buildHandshake(torrent));
    });

    onWholeMsg(socket, msg => msgHandler(msg, socket, requested, queue));

}

function onWholeMsg(socket, callback) {
    let savedBuf = Buffer.alloc(0);
    let handshake = true;

    socket.on('data', receivedBuf => {
        const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readUInt32BE(0) + 4;
        savedBuf = Buffer.concat(savedBuf, receivedBuf);

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

function msgHandler(msg, socket, requested, queue) {
    if (isHandshake(msg))
        socket.write(message.buildInterested());
    else {
        const m = message.parse(msg);

        if (m.id == 0) chokeHandler();
        if (m.id == 1) unchokeHandler();
        if (m.id == 4) haveHandler(m.payload, requested, queue);
        if (m.id == 5) bitfieldHandler(m.payload);
        if (m.id == 7) pieceHandler(socket, m.payload, requested, queue);
    }

}

function haveHandler(payload, socket, requested, queue) {
    //...
    const pieceIndex = payload.readUInt32BE(0);
    queue.push(pieceIndex);
    if (queue.length == 1)
        requestPiece(socket, requested, queue);
}

function pieceHandler(socket, payload, requested, queue) {
    queue.shift();
    requestPiece(socket, requested, queue);
}

function requestPiece(socket, requested, queue) {
    if (requested[queue[0]])
        queue.shift();
    else {
        requested[queue[0]] = true;
        socket.write(buildRequest(...));
    }
        
}


