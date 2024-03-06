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

- First you’ll want to create a tcp connection with all the peers in your list.The more peers you can get connected to the faster you can download your files.

- After exchanging some messages with the peer as setup, you should start requesting pieces of the files you want. As we’ll see shortly, a torrent’s shared files are broken up into pieces so that you can download different parts of the files from different peers simultaneously.

- Most likely there will be more pieces than peers, so once we’re done receiving a piece from a peer we’ll want to request the next piece we need from them. Ideally you want all the connections to be requesting different and new pieces so you’ll need to keep track of which pieces you already have and which ones you still need.

- Finally, when you receive the pieces they’ll be stored in memory so you’ll need to write the data to your hard disk. Hopefully at this point you’ll be done!

  
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

- The first thing you want to do is let your peer know know which files you are interested in downloading from them, as well as some identifying info. If the peer doesn’t have the files you want they will close the connection, but if they do have the files they should send back a similar message as confirmation. This is called the “handshake”.

- The most likely thing that will happen next is that the peer will let you know what pieces they have. This happens through the “have” and “bitfield” messages. Each “have” message contains a piece index as its payload. This means you will receive multiple have messages, one for each piece that your peer has.

- The bitfield message serves a similar purpose, but does it in a different way. The bitfield message can tell you all the pieces that the peer has in just one message. It does this by sending a string of bits, one for each piece in the file. The index of each bit is the same as the piece index, and if they have that piece it will be set to 1, if not it will be set to 0. For example if you receive a bitfield that starts with 011001… that means they have the pieces at index 1, 2, and 5, but not the pieces at index 0, 3,and 4.

- It’s possible to receive both “have” messages and a bitfield message, if which case you should combine them to get the full list of pieces.

- Actually it’s possible to recieve another kind of message, the peer might decide they don’t want to share with you! That’s what the choke, unchoke, interested, and not interested messages are for. If you are choked, that means the peer does not want to share with you, if you are unchoked then the peer is willing to share. On the other hand, interested means you want what your peer has, whereas not interested means you don’t want what they have.

- You always start out choked and not interested. So the first message you send should be the interested message. Then hopefully they will send you an unchoke message and you can move to the next step. If you receive a choke message message instead you can just let the connection drop.

- At this point you’re ready start requesting. You can do this by sending “request” messages, which contains the index of the piece that you want (more details on this in the next section).

- Finally you will receive a piece message, which will contain the bytes of data that you requested.

  ## Message Types

**handshake** 

  According to the spec the handshake message should be a buffer that looks like this:

  ```
  handshake: <pstrlen><pstr><reserved><info_hash><peer_id>

pstrlen: string length of <pstr>, as a single raw byte
pstr: string identifier of the protocol
reserved: eight (8) reserved bytes. All current implementations use all zeroes.
peer_id: 20-byte string used as a unique ID for the client.

In version 1.0 of the BitTorrent protocol, pstrlen = 19, and pstr = "BitTorrent protocol".
  ```

```javascript
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
```

All of the remaining messages in the protocol take the form of ```<length prefix><message ID><payload>```. The length prefix is a four byte big-endian value. The message ID is a single decimal byte. The payload is message dependent.

**keep-alive: <len=0000>**

```javascript
export const buildKeepAlive = () => Buffer.alloc(4);
```

**choke: <len=0001><id=0>**

The choke message is fixed-length and has no payload.

```javascript
export const buildChoke = () => {
    const buff = Buffer.alloc(5);

    // length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(0, 4);
    return buff;
};
```

**unchoke: <len=0001><id=1>**

The unchoke message is fixed-length and has no payload. 

```javascript
export const buildUnchoke = () => {
    const buff = Buffer.alloc(5);

    // length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(1, 0);
    return buff;
};
```

**interested: <len=0001><id=2>**

The interested message is fixed-length and has no payload. 

```javascript
export const buildInterested = () => {
    const buff = Buffer.alloc(5);

    // Length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(2, 0);
    return buff;
};
```

**not interested: <len=0001><id=3>**

The not interested message is fixed-length and has no payload. 

```javascript
export const buildNotinterested = () => {
    const buff = Buffer.alloc(5);

    // Length
    buff.writeUInt32BE(1, 0);
    // Id
    buff.writeUInt8BE(3, 0);
    return buff;
};
```

**have: <len=0005><id=4><piece index>**

The have message is fixed length. In the BitTorrent protocol, a "HAVE" message is 9 bytes long:

The first 4 bytes are an integer in network (big-endian) byte order that represents the length of the message, not including this length prefix. For a "HAVE" message, this will always be 1, because the message ID for "HAVE" is 1 byte long.

The next byte is the message ID for "HAVE", which is 4.

The final 4 bytes are another integer in network byte order that represents the zero-based index of the piece that has been downloaded.

```javascript
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
```

**bitfield: <len=0001+X><id=5><bitfield>**

The bitfield message may only be sent immediately after the handshaking sequence is completed, and before any other messages are sent. It is optional, and need not be sent if a client has no pieces.

The bitfield message is variable length, where X is the length of the bitfield. The payload is a bitfield representing the pieces that have been successfully downloaded. The high bit in the first byte corresponds to piece index 0. Bits that are cleared indicated a missing piece, and set bits indicate a valid and available piece. Spare bits at the end are set to zero. 

```javascript
export const buildBitfield = bitfield => {
    const buf = Buffer.alloc(bitfield.length + 5);
    // length
    buf.writeUInt32BE(bitfield.length + 1, 0);
    // id
    buf.writeUInt8(5, 4);
    // bitfield
    bitfield.copy(buf, 5);
    return buf;
}
```

**request: <len=0013><id=6><index><begin><length>**

The request message is fixed length, and is used to request a block. The payload contains the following information:

    index: integer specifying the zero-based piece index
    begin: integer specifying the zero-based byte offset within the piece
    length: integer specifying the requested length.

```javascript

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
```

**piece: <len=0009+X><id=7><index><begin><block>**

The piece message is variable length, where X is the length of the block. The payload contains the following information:

    index: integer specifying the zero-based piece index
    begin: integer specifying the zero-based byte offset within the piece
    block: block of data, which is a subset of the piece specified by index.

```javascript
buildPiece = payload => {
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
```

**cancel: <len=0013><id=8><index><begin><length>**

The cancel message is fixed length, and is used to cancel block requests. The payload is identical to that of the "request" message.

```javascript
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
```

**port: <len=0003><id=9><listen-port>**

The port message is sent by newer versions of the Mainline that implements a DHT tracker. The listen port is the port this peer's DHT node is listening on. This peer should be inserted in the local routing table (if DHT tracker is supported). 

```javascript
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
```

## Grouping messages

Before going on to actually exchanging messages, there's one more thing I need to address about tcp. You may have assumed that every time you receive a data though a socket, it will be a single whole message. But this is not the case. Remember our code for receiving data looked like this:

```javascript
socket.on('data', receivedBuffer => {
  // do stuff with receivedBuffer here
});
```

The problem is that the callback gets passed data as it becomes available and there’s no way to know how that data will be broken up. The socket might recieve only part of one message, or it might receive multiple messages at once. This is why every message starts with its length, to help you find the start and end of each message.

Things would be much easier for us if each time the callback was called it would get passed a single whole message, so I want to write a function onWhileMsg that will do just that for us.

```javascript
function download(peer) {
  const socket = net.Socket();
  socket.connect(peer.port, peer.ip, () => {
    // socket.write(...) write a message here
  });
  onWholeMsg(socket, data => {
    // handle response here
  });
}
```

Here is the implementation of **onWholeMsg**

```javascript
function onWholeMsg(socket, callback) {
  let savedBuf = Buffer.alloc(0);
  let handshake = true;

  socket.on('data', recvBuf => {
    // msgLen calculates the length of a whole message
    const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4;
    savedBuf = Buffer.concat([savedBuf, recvBuf]);

    while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
      callback(savedBuf.subarray(0, savedBuf.length));
      savedBuf = savedBuf.subarray(msgLen());
      handshake = false;
    }
  });
}
```

here's a step-by-step explanation of the onWholeMsg function:

- onWholeMsg is a function that takes two arguments: a socket and a callback function. The socket is used to receive data, and the callback function is called each time a whole message is received.

- Inside onWholeMsg, a buffer savedBuf is initialized to hold the incoming data. The handshake variable is set to true to indicate that the first message (the handshake message) hasn't been received yet.

- An event listener is set up on the socket to handle the 'data' event. This event is emitted whenever new data arrives on the socket. The event listener function takes the new data (recvBuf) as an argument.

- Inside the event listener function, a function msgLen is defined to calculate the length of a whole message. If handshake is true, it means this is the first message (the handshake message), and its length is calculated as savedBuf.readUInt8(0) + 49. If handshake is false, it means this is a regular message, and its length is calculated as savedBuf.readInt32BE(0) + 4.

- savedBuf is updated with the new data by concatenating savedBuf and recvBuf.

- A while loop starts, which continues as long as savedBuf has at least 4 bytes and enough data for a whole message. Inside the loop, the callback function is called with the whole message, savedBuf is updated to remove the message that was just processed, and handshake is set to false to indicate that the handshake message has been received.

- The while loop ensures that all complete messages in savedBuf are processed, even if multiple messages were received at once. If a message is only partially received, it will stay in savedBuf until the rest of the message arrives.

- This function ensures that the callback is called with a whole message each time, regardless of how the data is broken up when it arrives on the socket.

  ## Pieces

  After you establish the handshake your peers should tell you which pieces they have. Let’s take a moment to understand what pieces are exactly.

If you open up a torrent file, we saw that it contains data with various properties like the “announce” and “info” properties. Another property is the “piece length” property. This tells you how long a piece is in bytes. Let’s say hypothetically that you have a piece length of 1000 bytes. Then if the total size of the file(s) is 12000 bytes, that means the file should have 12 pieces. Note that the last piece might not be the full 1000 bytes. If the file were 12001 bytes large, then it would be a total of 13 pieces, where the last piece is just 1 byte large.

These pieces are indexed starting at 0, and this is how we know which piece it is that we are sending or receiving. For example, you might request the piece at index 0, that means from our previous example we want the first 1000 bytes of the file. If we ask for the piece at index 1, we want the second 1000 bytes and so on.

## Handling messages

Now I want to start handling messages that aren’t the handshake message. Since these messages have a set format, I can just check their id to figure out what message it is. In order to help me do this I wrote added a function to message.js for parsing message buffers into their parts:

```javascript
export const parse = msg => {
    const id = msg.length > 4 ? msg.readInt8(4) : null;
    let payload = msg.length > 5 ? msg.slice(5) : null;
    if (id == 6 || id == 7 || id == 8) {
        const rest = payload.slice(8);
        payload = {
            index: payload.readInt32BE(0),
            begin: payload.readInt32BE(4)
        };
        payload[id == 7 ? 'block' : 'length'] = rest;
    }

    return {
        size : msg.readInt32BE(0),
        id : id,
        payload: payload
    }

};
```

the parse() function is used to parse messages in a BitTorrent client. The messages are not handshake messages, but rather messages that follow a specific format. The function takes a Buffer object msg as an argument, which represents a message received from a peer.

Here's a breakdown of what the function does:

- It checks if the length of msg is greater than 4. If it is, it reads an 8-bit integer from the 5th byte (index 4) of msg and assigns it to id. If msg is not long enough, it assigns null to id.

- It checks if the length of msg is greater than 5. If it is, it slices msg from the 6th byte (index 5) to the end and assigns it to payload. If msg is not long enough, it assigns null to payload.

- If id is 6, 7, or 8, it further parses payload:

  - It slices payload from the 9th byte (index 8) to the end and assigns it to rest.

  - It reads two 32-bit integers from the start of payload and assigns them to payload.index and payload.begin.
  
  - If id is 7, it assigns rest to payload.block. If id is 6 or 8, it assigns rest to payload.length.

- Finally, it returns an object with three properties:

  - size: a 32-bit integer read from the start of msg.

  - id: the id parsed earlier.

  - payload: the payload parsed earlier.

The id value represents the type of the message, and the payload contains the data of the message. The size variable holds the length of the entire message. This function is designed to parse messages according to the BitTorrent protocol, where each message has a specific structure and each byte has a specific meaning.

## Managing connections and pieces

This is a critical point in the project because managing the connections and pieces involves a lot of interesting decisions and tradeoffs. So far we’ve mostly been following the specs directly, but from now on there are many possible solutions and I’ll be going through just one. That’s why I recommend taking some time to consider how you would implement these message handlers yourself before continuing.

Of course a big concern is efficiency. We want our downloads to finish as soon as possible. The tricky part about this is that not all peers will have all parts. Also not all peers can upload at the same rate. On top of that, it’s possible for connections to drop at any time, so we need a way of dealing with failed requests. How can we distribute the work of sharing the right pieces among all peers in order to have the fastest download speeds?

### List of requested pieces

First I would have a single list of all pieces that have already been requested that would get passed to each socket connection. Like this:

```javascript
export const downloadTorrent = torrent => {
    const requested = [];
    getPeers(torrent, peers => {
        peers.forEach(peer => download(peer, torrent, requested));
    });
};

function haveHandler(payload, socket, requested) {
    //...
    const pieceIndex = payload.readUInt32BE(0);
    if (!requested[pieceIndex]) 
        socket.write(buildRequest(...));
    requested[pieceIndex] = true;
}
```

The actual implementation of haveHandler will be more detailed than this, but you can see how the requested list will get passed through and how it will be used to determine whether or not a piece should be requested. You can also see that there is just a single list that is shared by all connections. Some of you may think that it’s inconvenient to have to pass the requested list to so many functions. Again, there’s more than one possible solution, so I encourage you to try you own.

This doesn’t yet account for failed requests, but I’ll be addressing that in a later section.

## Job queue

Next I want to create a list per connection. This list will contain all the pieces that a single peer has. Why do we have to maintain this list? Why not just make a request for a piece as soon as we receive a “have” or “bitfield” message? The problem is that we would probaby end up requesting all the pieces from the very first peer we connect to and then since we don’t want to double request the same piece, none of the other peers would have pieces left to request.

Even if it’s possible to use a round-robin strategy so that each peer only gets a second piece to request after all peers have gotten at least one piece to request, there is still a problem. This strategy would lead to all peers having the same number of requests, but some peers will inevitably upload faster than others. Ideally we want the fastest peers to get more requests, rather than have multiple requests bottlenecked by the slowest peer.

A natural solution is to request just one or a few pieces from a peer at a time, and only make the next request after receiving a response. This way the faster peers will send their responses faster, “coming back” for more requests more frequently.

However, because we recieve the “have” and “bitfield” messages all at once, this means we’ll have to store the list of pieces that the peer has. This is so that we can wait until the piece’s response come back, then we can reference the list to see what to request next.

I refer to this as a job queue, because you can think of it like this: each connection has a list of pieces to request. They look at the first item on the list, and check if it’s in the list of already requested pieces or not. If not, they request the piece and wait for a response. Otherwise they discard the item and move on to the next one. When they receive a response, they move on to the next item on the list and repeat the process until the list is empty.

**Example** <br>

Next I want to create a list per connection. This list will contain all the pieces that a single peer has. Why do we have to maintain this list? Why not just make a request for a piece as soon as we receive a “have” or “bitfield” message? The problem is that we would probaby end up requesting all the pieces from the very first peer we connect to and then since we don’t want to double request the same piece, none of the other peers would have pieces left to request.

Even if it’s possible to use a round-robin strategy so that each peer only gets a second piece to request after all peers have gotten at least one piece to request, there is still a problem. This strategy would lead to all peers having the same number of requests, but some peers will inevitably upload faster than others. Ideally we want the fastest peers to get more requests, rather than have multiple requests bottlenecked by the slowest peer.

A natural solution is to request just one or a few pieces from a peer at a time, and only make the next request after receiving a response. This way the faster peers will send their responses faster, “coming back” for more requests more frequently.

However, because we recieve the “have” and “bitfield” messages all at once, this means we’ll have to store the list of pieces that the peer has. This is so that we can wait until the piece’s response come back, then we can reference the list to see what to request next.

I refer to this as a job queue, because you can think of it like this: each connection has a list of pieces to request. They look at the first item on the list, and check if it’s in the list of already requested pieces or not. If not, they request the piece and wait for a response. Otherwise they discard the item and move on to the next one. When they receive a response, they move on to the next item on the list and repeat the process until the list is empty.

```javascript
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
```

In this code, I'm using a strategy where you request one piece at a time from each peer, rather than requesting all pieces from the first peer you connect to. This is done to optimize the download speed by leveraging the fact that different peers may send data at different rates.

Here's how it works in your code:

- When you receive a "have" message (indicating a peer has a piece), you add the piece to that peer's queue (queue.push(pieceIndex);).

- If this is the first piece in the queue, you request it (if (queue.length == 1) requestPiece(socket, requested, queue);).

- When you receive the piece, you remove it from the queue and request the next piece in the queue.

This way, I'm only requesting one piece at a time from each peer. Faster peers will finish sending their piece sooner, and you'll request the next piece from them sooner. This allows faster peers to send more pieces over the same amount of time, speeding up the overall download.

## Request Failures

Right now we are adding the piece index to the requested array whenever we send a request. This way we know which pieces have already been requested and then we can avoid the next peer from requesting a duplicate piece.

However, it’s possible for us to request a piece but never receive it. This is because a connection can drop at any time for whatever reason. Since we avoid requesting pieces that have been added to the requested array, these pieces will never be received.

You might think we could just add pieces to the list when we receive them. But then between the time that the piece requested and received any other peer could also request that piece resulting in duplicate requests.

The easiest solution is to maintain two lists, one for requested pieces and one for received pieces. We update the requested list at request time, and the received list at receive time. Then whenever we have requested all pieces but there are still pieces that we haven’t received, we copy the received list into the requested list, and that will allow us to rerequest those missing pieces.

pieces.js: <br>

```javascript
export const Pieces = class {
    constructor(size) {
        this.requested = new Array(size).fill(false);
        this.received = new Array(size).fill(false);
    }

    addRequested(pieceIndex) {
        this.requested[pieceIndex] = true;
    }

    addReceived(pieceIndex) {
        this.received[pieceIndex] = true;
    }

    needed(pieceIndex) {
        if (this.requested.every(i => i === true)) {
            this.requested = this.received.slice();
        }
        return !this.requested[pieceIndex];
    }

    isDone() {
        return this.received.every(i => i === true);
    }
};
```

This class is essentially a tracker for the pieces of a file being downloaded in a peer-to-peer network. It helps to manage which pieces have been requested and which have been received, ensuring that all pieces are eventually received.

- **constructor(size)**: This is the class constructor that is called when a new instance of the class is created. It takes a `size` parameter which represents the total number of pieces. It initializes two arrays, `requested` and `received`, of length `size` and fills them with `false`. This indicates that initially, no pieces have been requested or received.

- **addRequested(pieceIndex)**: This method is used to mark a piece as requested. It takes a `pieceIndex` parameter and sets the corresponding index in the `requested` array to `true`.

- **addReceived(pieceIndex)**: Similar to `addRequested`, this method marks a piece as received. It sets the corresponding index in the `received` array to `true`.

- **needed(pieceIndex)**: This method checks if a piece is needed, i.e., it hasn't been requested yet. If all pieces have been requested (`this.requested` array is filled with `true`), it resets the `requested` array to match the `received` array. This allows any pieces that were requested but not received to be requested again. It then returns whether the piece at `pieceIndex` is needed.

- **isDone()**: This method checks if all pieces have been received. It returns `true` if every element in the `received` array is `true`, indicating that all pieces have been received.

This class is a crucial part of the file download process in a peer-to-peer network. It ensures that all pieces are requested and received, and handles the scenario where a piece might be requested but not received due to issues like dropped connections.

