
var util = require('util')
  , events = require('events')
  , http = require('http')
  , ip = require('ip')
  , macaddress = require('macaddress')
  , uuid = require('uuid')
  , xmlbuilder = require('xmlbuilder')
  , _ = require('lodash')
  , SsdpServer = require('node-ssdp').Server

  , BELKIN_CONTROLLEE = "urn:Belkin:device:controllee:1"
  , BELKIN_BASICEVENT = "urn:Belkin:service:basicevent:1"
  , SETUP_XMLNS = 'urn:Belkin:device-1-0'
  , SETUP_TYPE = BELKIN_CONTROLLEE
  
    // NB: xml2js.Builder has a bug where attrs aren't
    //  handled correctly, so we use its dependency directly
  , XML = function(obj) {
        return xmlbuilder.create(obj).end();
    }
  , SERVER = new SsdpServer({
        logLevel: "WARN"
    });

SERVER.__started = false;
SERVER._nested = [];
var __getSSDPHeader = SsdpServer.prototype._getSSDPHeader;
SsdpServer.prototype._getSSDPHeader = function(method, headers, isResponse) {
    var server = SERVER._nested.filter(function(nested) {
        return nested._location == headers.LOCATION;
    })

    // not all requests will pass location; those that don't
    //  do not need our extra headers
    var uuid = server.length ? server[0].__device.uuid : undefined;

    return __getSSDPHeader.call(this, 
            method, _.extend(headers, {
        OPT: '"http://schemas.upnp.org/upnp/1/0/"; ns=01'
      , '01-NLS': uuid
      , 'X-User-Agent': 'redsonic'
    }), isResponse);
}

SERVER._respondToSearch = function(serviceType, rinfo) {
    console.log("SEARCH!", serviceType, SERVER._nested.length);
    SERVER._nested.forEach(function(nested) {
        nested._respondToSearch(serviceType, rinfo);
    });
}
SERVER.advertise = function(alive) {
    // console.log("ADVERTISE!", SERVER._nested.length);
    SERVER._nested.forEach(function(nested) {
        nested.advertise(alive);
    });
}
SERVER.add = function(child) {
    // console.log("ADD!");
    SERVER._nested.push(child);
}
  
function EmulatedDevice(opts) {

    if (!opts.friendlyName) throw new Error("friendlyName is required");
    if (!opts.uuid) opts.uuid = uuid.v4();
    if (!opts.port) opts.port = 0; // will assign a random port

    this.binaryState = opts.binaryState || 0;

    this.friendlyName = opts.friendlyName;
    this.uuid = opts.uuid;
    this.host = ip.address();

    var self = this;
    this.http = http.createServer(this._onHttpRequest.bind(this));
    this.http.listen(opts.port, function() {
        self.port = self.http.address().port;
        self._initSsdp();
    });
}
util.inherits(EmulatedDevice, events.EventEmitter);

EmulatedDevice.prototype.close = function() {
    this.http.close();
}

EmulatedDevice.prototype._initSsdp = function() {
    console.log("init ssdp", this.friendlyName, this.port);

    this.ssdp = new SsdpServer({
        allowWildcards: true
      , logLevel: 'TRACE'
      , location: 'http://' + this.host + ':' + this.port + '/setup.xml'
      , ttl: 86400
    }, SERVER.sock);
    this.ssdp.addUSN(BELKIN_CONTROLLEE);
    this.ssdp.addUSN(BELKIN_BASICEVENT);
    this.ssdp.__device = this;
    SERVER.add(this.ssdp);
    process.on('exit', this.close.bind(this));

    // TODO support devices with multiple interfaces....
    var ifaces = macaddress.networkInterfaces()
    var iface = ifaces[Object.keys(ifaces)[0]];
    this.mac = iface.mac.replace(/:/g, '').toUpperCase();
    this.emit('listening', this);
}

EmulatedDevice.prototype._onHttpRequest = function(req, res) {

    console.log(req.connection.remoteAddress, req.headers);

    var handler = this._endpoints[req.url];
    if (!handler) {
        console.log('404', this.friendlyName, "<<", req.method, req.url);
        res.writeHead(404);
        res.end();
        return;
    }

    console.log(this.friendlyName, "<<", req.method, req.url);

    handler.call(this, req, res);
}

EmulatedDevice.prototype._endpoints = {
    '/setup.xml': function(req, res) {
        res.writeHead(200);

        var xml = XML({
            root: {
                '@xmlns': SETUP_XMLNS
              , specVersion: {
                    major: 1
                  , minor: 0
                }
              , device: {
                    deviceType: SETUP_TYPE
                  , binaryState: this.binaryState
                  , friendlyName: this.friendlyName
                  , macAddress: this.mac

                  // now some BS stuff so others will accept us
                  , iconVersion: '0|49153'
                  , iconList: [
                      {icon: {
                          mimetype: 'jpg'
                        , width: 100
                        , height: 100
                        , depth: 100
                        , url: 'icon.jpg'
                      }}
                    ]
                  , firmwareVersion: "WeMo_US_2.00.7116.PVT" // tmp
                  , manufacturer: "Belkin International Inc." // tmp
                  , manufacturerURL: "http://www.belkin.com" // tmp
                  , modelDescription: "Belkin Plugin Socket 1.0" // tmp
                  , modelName: "Socket" // tmp
                  , modelNumber: 1.0
                  , modelURL: "http://www.belkin.com/plugin/" // tmp
                  , serialNumber: '123456K0101C00'
                  , UDN: this.ssdp._udn // hacks?
                  , UPC: 123456789
                  , presentationURL: '/pluginpres.html' // tmp?
                  , serviceList: [
                        {service: {
                            serviceType: 'urn:Belkin:service:basicevent:1'
                          , serviceId: 'urn:Belkin:serviceId:basicevent1'
                          , controlURL: '/upnp/control/basicevent1'
                          , eventSubURL: '/upnp/event/basicevent1'
                          , SCPDURL: '/eventservice.xml'
                        }}
                    ]
                }
            }
        });

        console.log(xml);
        res.write(xml);

        res.end();
    }
  , '/upnp/control/basicevent1': function(req, res) {
        
        console.log("UPNP control!");
        res.writeHead(204);
        res.end();
    }
}

module.exports = function Emulate(opts) {
    var device = new EmulatedDevice(opts);

    if (!SERVER.__started) {
        SERVER.__started = true;
        console.log("Starting...");
        var serverStarter;
        serverStarter = function() {
            device.removeListener('listening', serverStarter);
            SERVER.start();
            process.on('exit', function() {
                SERVER.stop();
            });
        };
        device.on('listening', serverStarter);
    }
    return device;
}

 
