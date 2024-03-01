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

    socket.on('data', data => {
        // handle response here
    });

}

function isHandshake(msg) {
    return msg.length === msg.readUInt8(0) + 49 &&
           msg.toString('utf8', 1) === 'BitTorrent protocol';
  }


