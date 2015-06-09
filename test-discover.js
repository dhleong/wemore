#!/usr/bin/env node

// var wemore = require('./');
// wemore.Discover()
// .on('device', function(device) {
//     if (device.friendlyName == 'television' 
//             || device.friendlyName == 'playstation') {
//         console.log(device);
//     }
// });

var SsdpClient = require('node-ssdp').Client
  , BELKIN_CONTROLLEE = "urn:Belkin:device:controllee:1"
  ;
var client = new SsdpClient();
client.on('response', function(resp) {
    console.log(resp);
});
client.search(BELKIN_CONTROLLEE);
