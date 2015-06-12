#!/usr/bin/env node

var wemore = require('./');
wemore.Discover()
.on('device', function(device) {
    // if (device.friendlyName == 'Television' 
    //         || device.friendlyName == 'PS4') {
        console.log(device);
    // }
});

// var SsdpClient = require('node-ssdp').Client
//   // , BELKIN_CONTROLLEE = "urn:Belkin:device:controllee:1"
//   , BELKIN_CONTROLLEE = "urn:Belkin:device:**"
//   ;
// var client = new SsdpClient({logLevel: 'TRACE'});
// client.on('response', function(resp) {
//     console.log(resp);
// });
// client.search(BELKIN_CONTROLLEE);
