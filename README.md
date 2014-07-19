wemore
======

A more awesome library for Belkin WeMo interactions. With acknowledgements to 
[wemo.js](https://github.com/thatguydan/wemo.js.git) for protocol reference.

### Usage

[![NPM](https://nodei.co/npm/wemore.png?mini=true)](https://nodei.co/npm/wemore/)

Toggle the first device found:

```javascript
var wemore = require('wemore')

var discovery = wemore.Discover()
.on('device', function(device) {
    device.toggleBinaryState();
    discovery.close();
});
```

Toggling a device by its friendly name:

```javascript
var wemore = require('wemore')

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

### Binary

Installing with `-g` provides the `wemore-toggle` executable:

```
usage: wemore-toggle <friendlyName>
```

It's simply a wrapper around the "toggle by friendly name" example above.
