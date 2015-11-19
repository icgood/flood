#!/usr/bin/env node
// Copyright (c) 2012 Ian C. Good
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//

var http = require('http'),
    crypto = require('crypto'),
    fs = require('fs'),
    path = require('path');

var snapshots = require('../lib/snapshots');

var configFile = process.argv[2] || 'config.json';
var config = JSON.parse(fs.readFileSync(configFile));

var code = fs.readFileSync(config.workerModule);
var privkey = fs.readFileSync(config.privateKeyFile);

var signer = crypto.createSign('RSA-SHA256');
signer.update(code);
var signature = signer.sign(privkey, 'base64');

config.env = config.env || {};
for (var name in process.env) {
  if (process.env.hasOwnProperty(name)) {
    if (name.slice(0, 6) === 'FLOOD_') {
      config.env[name.slice(6)] = process.env[name];
    }
  }
}

var total = new snapshots.Snapshots();
var received = 0;
function runClient(host) {
  var hostParts = host.split(':'),
      port = 5143;
  if (hostParts.length > 1) {
    host = hostParts.slice(0, -1).join(':');
    port = hostParts[hostParts.length-1];
  }
  http.request({
    host: host,
    port: port,
    method: 'POST',
    path: '/flood/'+path.basename(config.workerModule),
    headers: {
      'Content-Length': code.length,
      'Content-Type': 'text/javascript',
      'X-Signature': signature,
      'X-Snapshots': config.snapshots,
      'X-Snapshot-Length': config.interval,
      'X-Workers': config.numWorkers,
      'X-Dependencies': JSON.stringify(config.dependencies || null),
      'X-Env': JSON.stringify(config.env),
    },
  }, function (res) {
    if (res.statusCode === 200) {
      var parts = [];
      res.on('data', function (buf) {
        parts.push(buf);
      });
      res.on('end', function () {
        var data = JSON.parse(parts.join(''));
        total.add(snapshots.fromJSON(data));
        if (++received >= config.clients.length) {
          console.log(JSON.stringify(total));
        }
      });
    }
    else {
      console.log('ERROR: '+res.statusCode);
    }
  }).end(code);
}

var i;
for (i=0; i<config.clients.length; i++) {
  runClient(config.clients[i]);
}

// vim:et:sw=2:ts=2:sts=2:
