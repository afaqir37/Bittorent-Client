# BitTorrent Protocol

BitTorrent is a protocol used for downloading and distributing files across the Internet. Unlike the traditional client/server model where downloaders connect to a central server (such as watching a movie on Netflix, or loading the web page you're reading now), BitTorrent operates differently.

## Peer-to-Peer Protocol

In the BitTorrent network, participants are referred to as 'peers'. These peers download pieces of files from each other, making BitTorrent a peer-to-peer protocol. This decentralization is what sets it apart from traditional file distribution methods.

## Goal

I will build a simple bittorrent client from scratch in node.js. By the end I should be able to use the command line to download the shared contents of a torrent file.

## Overview of bittorent

Step 1: You need to send a request to something called a tracker, and the tracker will respond with a list of peers. More specifically, you tell the tracker which files you’re trying to download, and the tracker gives you the ip address of the users you download them from. Making a request to a tracker also adds your ip address to the list of users that can share that file.

Step 2: After you have the list of peer addresses, you want to connect to them directly and start downloading. This happens through an exchange of messages where they tell you what pieces they have, and you tell them which pieces you want.

## Opening the torrent file

javascript```
'use strict';
const fs = require('fs');
const torrent = fs.readFileSync('puppy.torrent');
console.log(torrent.toString('utf8'));
```

**readFileSync** is the easiest way to read the contents of a file. But if you run this code you’ll realize that **readFileSync** returns a buffer , not a string. Later on you’ll see that all our network messages are sent and received in the form of buffers, so it’s important that you have a good understanding of how they work. The short story is that buffers represent a sequence of raw bytes. If you want to read the buffer as a string you have to specify an encoding scheme (you can see I used utf-8 above).

The output should have looked something like this: 
```bash
d8:announce43:udp://trackercoppersurfertk:6969announce10:createdby13:uTorrent187013:creationdatei1462355939e8:encoding5:UTF-84:infod6:lengthi124234e4:name9:puppy.jpg12:piecelengthi16384e6:pieces160:T�k�/�_(�Sh%���+]q'B�٠:����p"�j���1-g"�s(��V��=�h�ma�nF�ǩ�_�"2���'�wO��-;ע�ؑ��L&����0�D_9��     \��O�h,n5g�(��仑,�\߰�%��U����C>��df��ee
```

### Bencode

That output probably looked fairly incomprehensible to you, and that’s because you’ve probably never heard of bencode. Bencode is data serialization format, and I don’t think I’ve seen it used anywhere outside of torrent files. But you may be familiar with JSON or XML, and bencode is essentially the same idea, it just uses a slightly different format.

Here’s the same data again in JSON: 

```
'{"announce":"udp://tracker.coppersurfer.tk:6969/announce","created by":"uTorrent/1870","creation date":1462355939,"encoding":"UTF-8","info":{"length":124234,"name":"puppy.jpg","piece length":16384,"pieces":"T�k�/�_(�S\\u0011h%���+]q\'B\\u0018�٠:����p\\"�j����1-g\\"\\u0018�s(\\u001b\\u000f���V��=�h�m\\u0017a�nF�2���N\\r�ǩ�_�\\u001e\\"2���\'�wO���-;\\u0004ע\\u0017�ؑ��L&����0\\u001f�D_9��\\t\\\\��O�h,n\\u001a5g�(��仑,�\\\\߰�%��U��\\u0019��C\\u0007>��df��"}}'
```

That should look a bit more familiar (except for the pieces property, which I’ll get to later). While it’s possible to write our own bencode parser, there are many good open source libraries that can do it for us. I just googled “bencode node” and installed the first result:

```
npm install --save bencode
```

## Getting peers via the tracker

```javascript

const torrent = bencode.decode(fs.readFileSync('puppy.torrent'));
const numbers = torrent.announce.toString('utf8').split(',').map(Number);
const string = numbers.map(number => String.fromCharCode(number)).join('');
console.log(string); // output: udp://tracker.coppersurfer.tk:6969/announce
```

In the code above I console.log the announce property of the torrent. For this particular file it happens to be udp://tracker.coppersurfer.tk:6969/announce. The announce url is what I’ve been calling the tracker’s url, it is the location of the torrent’s tracker.

One interesting thing you’ll notice is that instead of the usual ‘http’ in front, this url has ‘udp’. This is because instead of the http protocol, you must use the udp protocol. It used to be that all trackers used http, but nowadays nearly all new torrents are using udp. So what’s the difference between the two protocols, and why switch to udp?

### Http vs udp vs tcp

The main reason that most trackers now use udp is that udp has better performance than http. Http is built on top of another protocol called tcp, which we’ll use later in the project when we start actually downloading files from peers. So what’s the difference between tcp and udp?

The main difference is that tcp guarantees that when a user sends data, the other user will recieve that data in its entirety, uncorrupted, and in the correct order – but it must create a persistent connection between users before sending data and this can make tcp much slower than udp. In the case of upd, if the data being sent is small enough (less than 512 bytes) you don’t have to worry about receiving only part of the data or receiving data out of order. However, as we’ll see shortly, it’s possible that data sent will never reach its destination, and so you sometimes end up having to resend or re-request data.

For these reasons, udp is often a good choice for trackers because they send small messages, and we use tcp for when we actually transfer files between peers because those files tend to be larger and must arrive intact.

## UDP tracker protocol and message format

The 0x41727101980 is a constant defined by the BitTorrent protocol for the initial connection ID used in the UDP tracker protocol.

When a client wants to make a connection request to a tracker, it needs to send a specific message format. The first 64 bits of this message should be this connection ID (0x41727101980).

The tracker, upon receiving this message, recognizes this as a connection request due to this specific connection ID. After the initial connection is established, the tracker provides a different connection ID to be used for the rest of the session.

In order to get a list of peers from the tracker, the tracker will be expecting messages to follow a specific protocol. In short you must:

    Send a connect request
    Get the connect response and extract the connection id
    Use the connection id to send an announce request - this is where we tell the tracker which files we’re interested in
    Get the announce response and extract the peers list

## Connect messaging

Now let’s take a look at actually building the messages. Each message is a buffer with a specific format described in the BEP. Let’s take a look at the connect request first.

The BEP describes the connect request as follows:
```
Offset  Size            Name            Value
0       64-bit integer  connection_id   0x41727101980
8       32-bit integer  action          0 // connect
12      32-bit integer  transaction_id  ? // random
16
```

This tells us that our message should start out with a 64-bit (i.e. 8 bytes) integer at index 0, and that the value should be 0x41727101980. Since we just write 8 bytes, the index of the next part is 8. Now we write 32-bit integer (4 bytes) with the value 0. This moves us up to an offset of 12 bytes, and we write a random 32-bit integer. So the total message length is 8 bytes + 4 bytes + 4bytes = 16 bytes long.

Parsing the response is much simpler. Here’s how the response is formatted:

```
Offset  Size            Name            Value
0       32-bit integer  action          0 // connect
4       32-bit integer  transaction_id
8       64-bit integer  connection_id
16
```

## Announce messaging

Many of the concepts here are the same as the connect request and response. However there are some things to look out for that I’ll mention. Here’s the announce request below.

```
Offset  Size    Name    Value
0       64-bit integer  connection_id
8       32-bit integer  action          1 // announce
12      32-bit integer  transaction_id
16      20-byte string  info_hash
36      20-byte string  peer_id
56      64-bit integer  downloaded
64      64-bit integer  left
72      64-bit integer  uploaded
80      32-bit integer  event           0 // 0: none; 1: completed; 2: started; 3: stopped
84      32-bit integer  IP address      0 // default
88      32-bit integer  key             ? // random
92      32-bit integer  num_want        -1 // default
96      16-bit integer  port            ? // should be betwee
98
```

Now let’s take a look at parsing the response:

```
Offset      Size            Name            Value
0           32-bit integer  action          1 // announce
4           32-bit integer  transaction_id
8           32-bit integer  interval
12          32-bit integer  leechers
16          32-bit integer  seeders
20 + 6 * n  32-bit integer  IP address
24 + 6 * n  16-bit integer  TCP port
20 + 6 * N
```

It’s a bit tricky because the number of addresses that come back isn’t fixed. The addresses come in groups of 6 bytes, the first 4 represent the IP address and the next 2 represent the port. So our code will need to correctly break up the addresses part of the response.

```javascript
function parseAnnounceResp(resp) {
    function group(iterable, groupSize) {
        let groups = [];
        for (let i = 0; i < iterable.length; i += groupSize) {
          groups.push(iterable.slice(i, i + groupSize));
        }
        return groups;
      }


      return {
        action: resp.readUInt32BE(0),
        transactionId: resp.readUInt32BE(4),
        interval: resp.readUInt32BE(8),
        leechers: resp.readUInt32BE(12),
        seeders: resp.readUInt32BE(16),
        peers: group(resp.slice(20), 6).map(address => {
          return {
            ip: address.slice(0, 4).join('.'),
            port: address.readUInt16BE(4)
          }
        })
      }
}
```

### Info Hash

Now let’s go back to when we first opened the torrent file. Remember it looked something like this:

```
'{"announce":"udp://tracker.coppersurfer.tk:6969/announce","created by":"uTorrent/1870","creation date":1462355939,"encoding":"UTF-8","info":{"length":124234,"name":"puppy.jpg","piece length":16384,"pieces":"T�k�/�_(�S\\u0011h%���+]q\'B\\u0018�٠:����p\\"�j���1-g\\"\\u0018�s(\\u001b\\u000f���V��=�h�m\\u0017a�nF�2���N\\r�ǩ�_�\\u001e\\"2���\'�wO���-;\\u0004ע\\u0017�ؑ��L&����0\\u001f�D_9��\\t\\\\��O�h,n\\u001a5g�(��仑,�\\\\߰�%��U��\\u0019��C\\u0007>��df��"}}'
```

Last time we pulled the announce property from this object. Can you see that it also has an info property? If you were take the info property and pass it through a SHA1 hashing function, you would get the info hash! You can apply a SHA1 hash easily using the built-in crypto module.

```javascript
module.exports.infoHash = torrent => {
  const info = bencode.encode(torrent.info);
  return crypto.createHash('sha1').update(info).digest();
};
```

Why use a SHA1 hashing function? SHA1 is one of many hashing functions but it’s the one used by bittorrent so in our case no other hashing function will do. We want to use a hash because it’s a compact way to uniqely identify the torrent. A hashing function returns a fixed length buffer (in this case 20-bytes long).

## Downloading from peers

Now that we’re able to get a list of peers for our files, we want to actually download the files from them. Here’s a basic overview of how this will work:

    -First you’ll want to create a tcp connection with all the peers in your list.The more peers you can get connected to the faster you can download your files.

    -After exchanging some messages with the peer as setup, you should start requesting pieces of the files you want. As we’ll see shortly, a torrent’s shared files are broken up into pieces so that you can download different parts of the files from different peers simultaneously.

    -Most likely there will be more pieces than peers, so once we’re done receiving a piece from a peer we’ll want to request the next piece we need from them. Ideally you want all the connections to be requesting different and new pieces so you’ll need to keep track of which pieces you already have and which ones you still need.

    -Finally, when you receive the pieces they’ll be stored in memory so you’ll need to write the data to your hard disk. Hopefully at this point you’ll be done!

  
### TCP connect to peers

Using tcp to send messages is similar to udp which we used before. In this case we use the “net” module instead of the “dgram” module. Let’s look at an example of how that would work.

```javascript
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
```

You can see the tcp interface is very similar to using udp, but you have to call the connect method to create a connection before sending any messages. Also it’s possible for the connection to fail, in which case we don’t want the program to crash so we catch the error with socket.on('error', console.log). This will log the error to console instead. Udp didn’t have this problem because udp doesn’t need to create a connection.

We use our getPeers method from the tracker.js file, and then for each peer we create a tcp connection and start exchanging messages.

## Protocol Overview

Once a tcp connection is established the messages you send and receive have to follow the following protocol.

    The first thing you want to do is let your peer know know which files you are interested in downloading from them, as well as some identifying info. If the peer doesn’t have the files you want they will close the connection, but if they do have the files they should send back a similar message as confirmation. This is called the “handshake”.

    The most likely thing that will happen next is that the peer will let you know what pieces they have. This happens through the “have” and “bitfield” messages. Each “have” message contains a piece index as its payload. This means you will receive multiple have messages, one for each piece that your peer has.

    The bitfield message serves a similar purpose, but does it in a different way. The bitfield message can tell you all the pieces that the peer has in just one message. It does this by sending a string of bits, one for each piece in the file. The index of each bit is the same as the piece index, and if they have that piece it will be set to 1, if not it will be set to 0. For example if you receive a bitfield that starts with 011001… that means they have the pieces at index 1, 2, and 5, but not the pieces at index 0, 3,and 4.

    It’s possible to receive both “have” messages and a bitfield message, if which case you should combine them to get the full list of pieces.

    Actually it’s possible to recieve another kind of message, the peer might decide they don’t want to share with you! That’s what the choke, unchoke, interested, and not interested messages are for. If you are choked, that means the peer does not want to share with you, if you are unchoked then the peer is willing to share. On the other hand, interested means you want what your peer has, whereas not interested means you don’t want what they have.

    You always start out choked and not interested. So the first message you send should be the interested message. Then hopefully they will send you an unchoke message and you can move to the next step. If you receive a choke message message instead you can just let the connection drop.

    At this point you’re ready start requesting. You can do this by sending “request” messages, which contains the index of the piece that you want (more details on this in the next section).

    Finally you will receive a piece message, which will contain the bytes of data that you requested.

  


