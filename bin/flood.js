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
    crypto = require('crypto'),
    assert = require('assert'),
    npm = require('npm'),
    os = require('os'),
    fs = require('fs'),
    http = require('http'),
    url = require('url'),
    path = require('path'),
    argv = require('minimist')(process.argv.slice(2));

if (argv.help) {
  console.log('usage: '+process.argv.slice(0, 2).join(' ')+' [options]');
  console.log('  --help        Display this help.');
  console.log('  --port        Run on a custom port, default 5143');
  console.log('  --public-key  Path to the public key,');
  console.log('                    default /etc/flood/public.pem');
  process.exit(0);
}

var snapshots = require('../lib/snapshots');

cluster.setupMaster({
  exec: __dirname+'/../lib/worker.js',
});

var pubkeyFile = argv['public-key'] || '/etc/flood/public.pem',
    pubkey = fs.readFileSync(pubkeyFile);


function killAll(workers) {
  var i;
  for (i=0; i<workers.length; i++) {
    workers[i].destroy();
  }
}

function installDeps(deps, callback) {
  if (!deps || deps.length === 0) {
    process.nextTick(callback);
    return;
  }

  npm.load({loglevel: 'warn'}, function (err, npm) {
    assert.ifError(err);
    npm.commands.install(deps, function (err) {
      assert.ifError(err);
      process.nextTick(callback);
    });
  });
}

function startTest(options, res) {
  var i;
  var total = new snapshots.Snapshots();
  var running = options.workers;
  var workers = new Array(options.workers);
  for (i=0; i<options.workers; i++) {
    workers[i] = cluster.fork(options.env);
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

var server = http.createServer(function (req, res) {
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
  if (path.dirname(urlpath) !== '/flood') {
    res.writeHead(404);
    res.end();
    return;
  }
  var fileParts = [];
  var verifier = crypto.createVerify('RSA-SHA256');
  req.on('data', function (buf) {
    verifier.update(buf);
    fileParts.push(buf);
  });
  req.on('end', function () {
    if (!verifier.verify(pubkey, req.headers['x-signature'], 'base64')) {
      res.writeHead(401);
      res.end('X-Signature header was not a valid content signature.\n');
      return;
    }
    var numWorkers = parseInt(req.headers['x-workers'] || 0);
    var options = {
      filename: path.basename(urlpath),
      snapshots: req.headers['x-snapshots'] || 10,
      snapshotLength: req.headers['x-snapshot-length'] || 1000,
      workers: numWorkers > 0 ? numWorkers : os.cpus().length + numWorkers,
      file: fileParts.join(''),
      env: JSON.parse(req.headers['x-env'] || null),
    };

    var deps = JSON.parse(req.headers['x-dependencies'] || null);
    installDeps(deps, function () {
      startTest(options, res);
    });
  });
});
server.setTimeout(0);

server.listen(argv.port || 5143);

// vim:ft=javascript:et:sw=2:ts=2:sts=2:
