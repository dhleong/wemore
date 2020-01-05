
var util = require('util')
  , events = require('events')
  , SsdpClient = require('node-ssdp').Client
  , Q = require('q')

  , WemoDevice = require('./device')

  , BELKIN_CONTROLLEE = "urn:Belkin:device:controllee:1"
  , DEFAULT_TIMEOUT = 3000;

function Discovery() {
    this.close(); // will also set up a new client

    // send the search packet a couple of times...
    //  hopefully will more reliably get a response
    this.client.search(BELKIN_CONTROLLEE);
    this.client.search(BELKIN_CONTROLLEE);
}
util.inherits(Discovery, events.EventEmitter);

Discovery.prototype.close = function() {
    // hax?
    if (this.client) {
        this.client._stop();
    }

    // create a new one (apparently they're one-use only)
    this.client = new SsdpClient();
    this.client.on('response', this._onResponse.bind(this));
};

Discovery.prototype._onResponse = function(headers, statusCode) {
    var self = this;
    var device = new WemoDevice(headers.LOCATION);
    device.statusCode = statusCode;
    device.resolve()
    .then(function(device) {
        self.emit('device', device);
    })
    .catch(function(err) {
        self.emit('error', err);
    });
};


function Search(friendlyName, timeout) {
    var discovery = new Discovery();
    if (friendlyName) {
        timeout = timeout || DEFAULT_TIMEOUT;
        return Q.Promise(function(resolve, reject) {
            var gaveup = setTimeout(function() {
                discovery.close();
                reject(new Error("Timed out looking for device " + friendlyName));
            }, timeout);

            var onDeviceFound = function(device) {
                if (device.friendlyName == friendlyName) {
                    clearTimeout(gaveup);
                    discovery.removeListener('device', onDeviceFound);
                    discovery.close();
                    resolve(device);
                }
            };
            discovery.on('device', onDeviceFound);
            discovery.on('error', function(err) {
                console.error('WARN', err);
            });
        });
    }

    return discovery;
}

module.exports = {
    Discovery: Discovery
  , Search: Search
};
