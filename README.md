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