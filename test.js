#!/usr/bin/env node

var wemore = require('./');

var ps4 = wemore.Emulate({friendlyName: "PS4"});
var tv = wemore.Emulate({friendlyName: "Television"});

ps4.on('on', function() {
    console.log("Turn on the PS4!!!");
});


tv.on('off', function() {
    console.log("Turn off the TV!!!");
});

tv.on('listening', function() {
    console.log("TV ready!");
});
