
var util = require('util')
  , events = require('events')
  , http = require('http')
  , ip = require('ip')
  , uuid = require('uuid')
  , xml2js = require('xml2js')
  , xmlbuilder = require('xmlbuilder')
  , _ = require('lodash')

  , stripPrefix = xml2js.processors.stripPrefix
  , parseXml = xml2js.parseString
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
  , SERVER = new SsdpServer();

SERVER.__started = false;
SERVER.__lastSerial = 0;
SERVER._nested = [];
var __getSSDPHeader = SsdpServer.prototype._getSSDPHeader;
SsdpServer.prototype._getSSDPHeader = function(method, headers, isResponse) {
    var server = SERVER._nested.filter(function(nested) {
        return nested._location == headers.LOCATION;
    });

    // not all requests will pass location; those that don't
    //  do not need our extra headers
    var uuid = server.length ? server[0].__device.uuid : undefined;

    return __getSSDPHeader.call(this,
            method, _.extend(headers, {
                OPT: '"http://schemas.upnp.org/upnp/1/0/"; ns=01'
              , '01-NLS': uuid
              , 'X-User-Agent': 'redsonic'
            }), isResponse);
};

SERVER._respondToSearch = function(serviceType, rinfo) {
    SERVER._nested.forEach(function(nested) {
        nested._respondToSearch(serviceType, rinfo);
    });
};
SERVER.advertise = function(alive) {
    SERVER._nested.forEach(function(nested) {
        nested.advertise(alive);
    });
};
SERVER.add = function(child) {
    SERVER._nested.push(child);
};
SERVER.remove = function(child) {
    var index = SERVER._nested.indexOf(child);
    if (index !== -1) {
        SERVER._nested.splice(index, 1);
    }
}

/**
 * All params except for friendlyName are optional
 * @param friendlyName The human-readable name for
 *         the device. You will speak this name when
 *         using the Echo, for example
 * @param binaryState The initial binaryState
 * @param serial A unique string identifying this
 *         device. If you always initialize devices
 *         in the same order, we will always generate
 *         a consistent serial for them.
 */
function EmulatedDevice(opts) {

    if (!opts.friendlyName) throw new Error("friendlyName is required");
    if (!opts.uuid) opts.uuid = uuid.v4();
    if (!opts.port) opts.port = 0; // will assign a random port

    this.binaryState = opts.binaryState || 0;

    this.friendlyName = opts.friendlyName;
    this.logLevel = opts.logLevel;
    this.uuid = opts.uuid;
    this.host = ip.address();

    // assign a serial number
    if (!opts.serial) {
        var index = "" + (++SERVER.__lastSerial);
        while (index.length < 6) {
            index = '0' + index;
        }
        this.serial = index + 'F0101C00';
    } else {
        this.serial = opts.serial;
    }

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
    SERVER.remove(this.ssdp);
};

EmulatedDevice.prototype._initSsdp = function() {
    this.ssdp = new SsdpServer({
        allowWildcards: true
      , logLevel: this.logLevel
      , location: 'http://' + this.host + ':' + this.port + '/setup.xml'
      , ttl: 86400
      , udn: 'uuid:' + this.uuid
    }, SERVER.sock);
    this.ssdp.addUSN(BELKIN_CONTROLLEE);
    this.ssdp.addUSN(BELKIN_BASICEVENT);
    this.ssdp.__device = this;

    SERVER.add(this.ssdp);
    process.on('exit', this.close.bind(this));
    this.emit('listening', this);
};

EmulatedDevice.prototype._onHttpRequest = function(req, res) {

    var handler = this._endpoints[req.url];
    if (!handler) {
        if (this.logLevel) {
            console.log('404', this.friendlyName,
                "<<", req.method, req.url);
        }
        res.writeHead(404);
        res.end();
        return;
    }

    if (this.logLevel == 'TRACE') {
        console.log(this.friendlyName, "<<", req.method, req.url);
    }

    handler.call(this, req, res);
};

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

                  // now some BS stuff so others will accept us
                  , manufacturer: "Belkin International Inc." // req
                  , manufacturerURL: "http://github.com/dhleong"
                  , modelDescription: "Wemore Emulated Socket"
                  , modelName: "Socket"
                  , modelNumber: 1.0
                  , modelURL: "http://github.com/dhleong/wemore"
                  , serialNumber: this.serial
                  , UDN: 'uuid:' + this.uuid // Echo uses this to identify
                  , UPC: 123456789
                  , serviceList: [
                        {
                            service: {
                                serviceType: 'urn:Belkin:service:basicevent:1'
                              , serviceId: 'urn:Belkin:serviceId:basicevent1'
                              , controlURL: '/upnp/control/basicevent1'
                              , eventSubURL: '/upnp/event/basicevent1'
                              , SCPDURL: '/eventservice.xml'
                            }
                        }
                    ]
                }
            }
        });

        res.write(xml);
        res.end();
    }

    , '/eventservice.xml': function(req, res) {
        res.writeHead(200);

        var xml = XML({
            scpd: {
                '@xmlns': SETUP_XMLNS
                , specVersion: {
                    major: 1
                  , minor: 0
                }
              , actionList: [
                    {
                        action: {
                            name: 'GetBinaryState'
                        }
                    }
                  , {
                        action: {
                            name: 'SetBinaryState'
                        }
                    }
                ]
            }
        });

        res.write(xml);
        res.end();
    }

  , '/upnp/control/basicevent1': function(req, res) {
        var self = this
          , buffer = '';

        var handleRequest = function(xml) {
            var body = xml.Envelope.Body;
            if (body.GetBinaryState) {
                res.writeHead(200);
                res.write(XML({
                    's:Envelope': {
                        '@xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/'
                            , '@s:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/'
                            , 's:Body': {
                                'u:GetBinaryStateResponse': {
                                    '@xmlns:u': 'urn:Belkin:service:basicevent:1'
                                        , BinaryState: self.binaryState
                                }
                            }
                    }
                }));
                res.end();

            } else if (body.SetBinaryState) {

                var senderInfo = {
                    address: req.socket.remoteAddress
                  , port: req.socket.remotePort
                };

                self.binaryState =
                    parseInt(body.SetBinaryState.BinaryState);
                if (self.binaryState) {
                    self.emit('on', self, senderInfo);
                } else {
                    self.emit('off', self, senderInfo);
                }

                self.emit('state', self.binaryState, self, senderInfo);
                res.writeHead(200);
                res.write(XML({
                    's:Envelope': {
                        '@xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/'
                            , '@s:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/'
                            , 's:Body': {
                                'u:SetBinaryStateResponse': {
                                    '@xmlns:u': 'urn:Belkin:service:basicevent:1'
                                        , BinaryState: self.binaryState
                                }
                            }
                    }
                }));
                res.end();

            } else {
                if (self.logLevel) {
                    console.warn("Unexpected body", body);
                }
                res.writeHead(400);
                res.end();
            }
        };

        // this isn't terribly efficient, but these
        //  requests shouldn't be that large anyway
        //  so it's probably not worth it to add
        //  another dependency....
        req.on('data', function(data) {
            buffer += data.toString();
        });
        req.on('end', function() {
            parseXml(buffer, {
                explicitArray: false
              , tagNameProcessors: [stripPrefix]
            }, function(err, xml) {
                if (err) {
                    console.warn(err.stack);
                    res.writeHead(500);
                    res.end();
                    return;
                }

                handleRequest(xml);
            });
        });
    }
};

module.exports = function Emulate(opts) {
    var device = new EmulatedDevice(opts);

    if (!SERVER.__started) {
        SERVER.__started = true;
        var serverStarter = function() {
            SERVER.start();
            process.on('exit', function() {
                SERVER.stop();
            });
        };
        device.once('listening', serverStarter);
    }
    return device;
};
