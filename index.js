
'use strict';
import fs from 'fs';
import bencode from 'bencode';


const torrent = bencode.decode(fs.readFileSync('puppy.torrent'));
const numbers = torrent.announce.toString('utf8').split(',').map(Number);
const string = numbers.map(number => String.fromCharCode(number)).join('');
console.log(string); // output: udp://tracker.coppersurfer.tk:6969/announce