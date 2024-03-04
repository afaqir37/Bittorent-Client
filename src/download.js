// import net module
import net from 'net';
import { Buffer } from 'buffer';
import { getPeers } from './tracker.js';
import * as message from './message.js';

module.exports = torrent => {
    getPeers(torrent, peers => {
        peers.forEach(download);
    });
};

function download(peer) {
    const socket = net.Socket();
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        socket.write(message.buildHandshake(torrent));
    });

    onWholeMsg(socket, data => {
        // handle response here

    });

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


