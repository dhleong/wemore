#!/usr/bin/env node

var wemore = require('./');

// wemore.Discover()
// .on('device', function(device) {
//     console.log(device);
// });

var ps4 = wemore.Emulate({friendlyName: "playstation"});
var tv = wemore.Emulate({friendlyName: "television"});

