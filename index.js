#!/usr/bin/env node

module.exports = require('./lib/device')
module.exports.Emulate = require('./lib/emulate')
module.exports.Discover = require('./lib/discover').Search
