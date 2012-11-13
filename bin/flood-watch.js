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
    fs = require('fs'),
    path = require('path');

var snapshots = require('../lib/snapshots');

var configFile = process.argv[2] || 'config.json';
var config = JSON.parse(fs.readFileSync(configFile));

var code = fs.readFileSync(config.workerModule);

var total = new snapshots.Snapshots();
var received = 0;
function runClient(host) {
  http.request({
    host: host,
    port: 5143,
    method: 'POST',
    path: '/test/'+path.basename(config.workerModule),
    headers: {
      'Content-Length': code.length,
      'Content-Type': 'text/javascript',
      'X-Snapshots': config.snapshots,
      'X-Snapshot-Length': config.interval,
      'X-Workers': config.numWorkers,
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
