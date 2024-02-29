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