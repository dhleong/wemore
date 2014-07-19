
var util = require('util')
  , url = require('url')
  , request = require('request')
  , parseXml = require('xml2js').parseString
  , Q = require('q')

  , COPY_FIELDS = ['friendlyName', 'modelName', 'modelNumber', 
        'modelURL', 'serialNumber', 'macAddress', 'firmwareVersion']
    // NB: binaryState IS returned, but seems to be 0 even if
    //  the thing is on :(

  , SOAPPAYLOAD = [
        '<?xml version="1.0" encoding="utf-8"?>'
      , '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"'
      , '    s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
      , ' <s:Body>'
      , '  <u:%s xmlns:u="urn:Belkin:service:basicevent:1">'
      , '   <BinaryState>%s</BinaryState>'
      , '  </u:%s>'
      , ' </s:Body>'
      , '</s:Envelope>'
    ].join('\n');

/** Based on wemo.js; Not beautiful, but it does the job... */
function soapRequest(host, method, arg) {
    var payload = util.format(SOAPPAYLOAD, method, arg, method);

    return Q.Promise(function(resolve, reject) {
        request({
            method: 'POST'
          , body: payload
          , uri: 'http://' + host + '/upnp/control/basicevent1'
          , headers: {
                'Content-Type': 'text/xml; charset="utf-8"'
              , 'Content-Length': payload.length
              , SOAPACTION: '"urn:Belkin:service:basicevent:1#' + method + '"'
            }

        }, function(err, response) {
            if (err || response.statusCode >= 300)
                return reject(err || new Error('Invalid Request'));

            resolve(response);
        });
    });
}

function WemoDevice(location) {
    this.location = location;
    this.host = url.parse(location).host;
}

/**
 * Attempt to gather more information about
 *  the device (and ensure that it exists).
 *  Devices returned by the Discover API
 *  will already be resolved.
 *
 * @return a Promise that is resolved with
 *  this same device again, with all extra
 *  fields resolved. If this instance was
 *  already resolved, no extra work is performed
 */
WemoDevice.prototype.resolve = function() {
    var existing = this._resolvePromise;
    if (existing) 
        return existing;

    var self = this;
    var newDeferred = Q.defer();
    this._resolvePromise = newDeferred.promise;
    request(this.location, function(error, response) {
        if (error)
            return newDeferred.reject(error);

        parseXml(response.body, function(err, json) {
            if (err) return newDeferred.reject(err);

            var deviceInfo = json.root.device[0];
            self._rawInfo = deviceInfo;

            // copy over some useful fields
            COPY_FIELDS.forEach(function(field) {
                if (deviceInfo[field])
                    self[field] = deviceInfo[field][0].trim();
            });

            newDeferred.resolve(self);
        });
    });

    return newDeferred.promise;
};

/**
 * Fetch the latest binary state.
 * @return a Promise which resolves to an int
 *  0 or 1 for the binary state. After the Promise
 *  resolves, the most recent value will be stored
 *  in a field on this object as binaryState
 */
WemoDevice.prototype.getBinaryState = function() {
    var self = this;
    return soapRequest(this.host, 'GetBinaryState', '').then(function(resp) {
        return Q.nfcall(parseXml, resp.body)
        .then(function(json) {
            return Q.fcall(function() {
                // drill down...
                var body = json['s:Envelope']['s:Body'][0];
                var response = body['u:GetBinaryStateResponse'][0];
                var state = response.BinaryState[0];

                // *phew*
                self.binaryState = parseInt(state);
                return self.binaryState; 
            });
        });
    });
};

WemoDevice.prototype.setBinaryState = function(state) {
    var self = this;
    var value = state ? 1 : 0;
    var promise = soapRequest(this.host, 'SetBinaryState', value);
    promise.then(function() {
        // if we succeeded, update our internal value
        self.binaryState = value;
    });
    return promise;
};

WemoDevice.prototype.toggleBinaryState = function() {
    // if we already know... easy!
    if (this.binaryState !== undefined) 
        return this.setBinaryState(!this.binaryState);

    // otherwise, let's fetch
    var self = this;
    return this.getBinaryState().then(function(state) {
        return self.setBinaryState(!state);
    });
};


module.exports = WemoDevice;
