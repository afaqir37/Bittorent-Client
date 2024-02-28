# BitTorrent Protocol

BitTorrent is a protocol used for downloading and distributing files across the Internet. Unlike the traditional client/server model where downloaders connect to a central server (such as watching a movie on Netflix, or loading the web page you're reading now), BitTorrent operates differently.

## Peer-to-Peer Protocol

In the BitTorrent network, participants are referred to as 'peers'. These peers download pieces of files from each other, making BitTorrent a peer-to-peer protocol. This decentralization is what sets it apart from traditional file distribution methods.

## Goal

I will build a simple bittorrent client from scratch in node.js. By the end I should be able to use the command line to download the shared contents of a torrent file.

## Overview of bittorent

Step 1: You need to send a request to something called a tracker, and the tracker will respond with a list of peers. More specifically, you tell the tracker which files you’re trying to download, and the tracker gives you the ip address of the users you download them from. Making a request to a tracker also adds your ip address to the list of users that can share that file.

Step 2: After you have the list of peer addresses, you want to connect to them directly and start downloading. This happens through an exchange of messages where they tell you what pieces they have, and you tell them which pieces you want.