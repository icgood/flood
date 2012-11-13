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

var cluster = require('cluster'),
    os = require('os'),
    http = require('http'),
    url = require('url'),
    path = require('path');

var snapshots = require('../lib/snapshots');

cluster.setupMaster({
  exec: __dirname+'/../lib/worker.js',
});

function killAll(workers) {
  var i;
  for (i=0; i<workers.length; i++) {
    workers[i].destroy();
  }
}

function startTest(options, res) {
  var i;
  var total = new snapshots.Snapshots();
  var running = options.workers;
  var workers = new Array(options.workers);
  for (i=0; i<options.workers; i++) {
    workers[i] = cluster.fork();
    workers[i].send(options)
    workers[i].on('message', function (msg) {
      var workerSnapshots = snapshots.fromJSON(msg);
      total.add(workerSnapshots);
      if (--running <= 0) {
        killAll(workers);
        res.writeHead(200);
        res.end(JSON.stringify(total)+'\n');
      }
    });
  }

  cluster.on('exit', function (worker, code, signal) {
    if (!worker.suicide) {
      killAll(workers);
      res.writeHead(500);
      res.end('Worker '+worker.process.pid+' died: '+signal+'\n');
    }
  });
}

http.createServer(function (req, res) {
  if (req.method !== 'POST') {
    res.writeHead(404);
    res.end();
    return;
  }
  if (req.headers['content-type'] !== 'text/javascript') {
    res.writeHead(415);
    res.end();
    return;
  }
  var urlpath = url.parse(req.url).pathname;
  if (path.dirname(urlpath) !== '/test') {
    res.writeHead(404);
    res.end();
    return;
  }
  var fileParts = [];
  req.on('data', function (buf) {
    fileParts.push(buf);
  });
  req.on('end', function () {
    var numWorkers = parseInt(req.headers['x-workers'] || 0);
    var options = {
      filename: path.basename(urlpath),
      snapshots: req.headers['x-snapshots'] || 10,
      snapshotLength: req.headers['x-snapshot-length'] || 1000,
      workers: numWorkers > 0 ? numWorkers : os.cpus().length + numWorkers,
      file: fileParts.join(''),
    };
    startTest(options, res);
  });
}).listen(5143);

// vim:ft=javascript:et:sw=2:ts=2:sts=2:
