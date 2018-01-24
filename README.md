wemore
======

A more awesome library for Belkin WeMo interactions. With acknowledgements to 
[wemo.js](https://github.com/thatguydan/wemo.js.git) for protocol reference.

### Usage

[![NPM](https://nodei.co/npm/wemore.png?mini=true)](https://nodei.co/npm/wemore/)

Toggle the first device found:

```javascript
var wemore = require('wemore')

// with no args, a Discovery object is returned
//  that emits device events as they're discovered
var discovery = wemore.Discover()
.on('device', function(device) {
    device.toggleBinaryState();
    discovery.close(); // stop discovering
});
```

Toggling a device by its friendly name:

```javascript
var wemore = require('wemore')

// when the friendly name is provided, a Promise is returned
wemore.Discover('Lights')
.then(function(device) {
    return device.toggleBinaryState();
})
.then(function() {
    console.log("Success!");
})
.fail(function(err) {
    console.error("Couldn't find device", err);
});

```

#### Emulate Devices

Wemore also provides a facility for emulating devices, allowing you to
transparently respond to toggle events from another device on the network,
like perhaps the Amazon Echo.

```javascript
var wemore = require('wemore');

// note that each device needs a separate port:
var tv = wemore.Emulate({friendlyName: "TV", port: 9001}); // choose a port
var stereo = wemore.Emulate({friendlyName: "Stereo"}); // automatically assigned

stereo.on('listening', function() {
    // if you want it, you can get it:
    console.log("Stereo listening on", this.port);
});

tv.on('state', function(binaryState, self, sender) {
    console.log("TV set to=", binaryState);
    tv.close(); // stop advertising the device
});

// also, 'on' and 'off' events corresponding to binary state
stereo.on('on', function(self, sender) {
    console.log("Stereo turned on");
});

stereo.on('off', function(self, sender) {
    console.log("Stereo turned off");
});
```

If you need information about who requested the event, it is provided as a
"Sender object" that looks something like this:

```javascript
{
    address: '::ffff:192.168.1.23',
    port: 12345
}
```

See [Socket.remoteAddress](https://nodejs.org/api/net.html#net_socket_remoteaddress)
for more information about these values.

### Binary

Installing with `-g` provides the `wemore-toggle` executable:

```
usage: wemore-toggle <friendlyName>
```

It's simply a wrapper around the "toggle by friendly name" example above.
