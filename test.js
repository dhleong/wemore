#!/usr/bin/env node

var wemore = require('./');

// wemore.Discover()
// .on('device', function(device) {
//     console.log(device);
// });

// wemore.Emulate({friendlyName: "PS4"});
wemore.Emulate({friendlyName: "Television"});

