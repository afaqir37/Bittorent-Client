// import net module
import net from 'net';
import { Buffer } from 'buffer';
import { getPeers } from './tracker.js';

module.exports = torrent => {
    getPeers(torrent, peers => {
        peers.forEach(download);
    });
};

function download(peer) {
    const socket = net.Socket();
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        //
    });

    socket.on('data', data => {
        // handle response here
    });

}


