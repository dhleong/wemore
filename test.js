#!/usr/bin/env node

var wemore = require('./');

// wemore.Discover()
// .on('device', function(device) {
//     console.log(device);
// });

wemore.Emulate({friendlyName: "playstation"});
// wemore.Emulate({friendlyName: "television"});

