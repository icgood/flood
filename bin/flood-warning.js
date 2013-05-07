#!/usr/bin/env node
// Copyright (c) 2013 Ian C. Good
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

var fs = require('fs');

var config = JSON.parse(fs.readFileSync(process.argv[2]));

process.stdin.resume();
process.stdin.setEncoding('utf8');

var parts = [];
process.stdin.on('data', function (chunk) {
  parts.push(chunk);
});

process.stdin.on('end', function () {
  var data = JSON.parse(parts.join(''));
  var fw = new FloodWarning(data.snapshots);
  fw.calculate();
  fw.checkConditions();
  fw.producePlotData();
});

function FloodWarning(snapshots) {
  this.snapshots = snapshots;
  this.averages = {};
  this.minimums = {};
  this.maximums = {};
  this.totals = {};
}

function getCounters(snapshots) {
  var counters = [];
  var key;
  for (key in snapshots[0]) {
    if (snapshots[0].hasOwnProperty(key)) {
      counters.push(key);
    }
  }
  return counters;
}

function getCounterRecords(counter, snapshots) {
  var recs = [];
  var i;
  for (i=0; i<snapshots.length; i++) {
    recs.push(snapshots[i][counter]);
  }
  return recs;
}

FloodWarning.prototype.calculate = function () {
  var self = this;
  var counters = getCounters(self.snapshots);

  counters.forEach(function (counter) {
    var records = getCounterRecords(counter, self.snapshots);
    var min_i = 0;
    var max_i = 0;
    var total = records[0];
    var i;
    for (i=1; i<records.length; i++) {
      total += records[i];
      if (records[i] > records[max_i]) {
        max_i = i;
      }
      if (records[i] < records[min_i]) {
        min_i = i;
      }
    }
    var totalNoOutliers = total - records[min_i] - records[max_i];
    if (totalNoOutliers > 0 && records.length >= 10) {
      self.averages[counter] = Math.floor(Math.round(
            totalNoOutliers/(records.length - 2)));
    }
    else {
      self.averages[counter] = Math.floor(Math.round(total/records.length));
    }
    self.minimums[counter] = Math.floor(records[min_i]);
    self.maximums[counter] = Math.floor(records[max_i]);
    self.totals[counter] = Math.floor(total);
  });
};

FloodWarning.prototype.getData = function (counter, which) {
  if (which === 'average') {
    return this.averages[counter];
  }
  else if (which === 'minimum') {
    return this.minimums[counter];
  }
  else if (which === 'maximum') {
    return this.maximums[counter];
  }
  else if (which === 'total') {
    return this.totals[counter];
  }
  throw 'Invalid Rule';
};

FloodWarning.prototype.matchRule = function (rule) {
  var parts = rule.split(' ', 4);
  if (parts.length !== 4) {
    throw 'Invalid Rule';
  }
  var counter = parts[0], which = parts[1], op = parts[2], value = parts[3];
  if (op === '>') {
    return this.getData(counter, which) > Math.floor(value);
  }
  else if (op === '>=') {
    return this.getData(counter, which) >= Math.floor(value);
  }
  else if (op === '<') {
    return this.getData(counter, which) < Math.floor(value);
  }
  else if (op === '<=') {
    return this.getData(counter, which) <= Math.floor(value);
  }
  else if (op === '==') {
    return this.getData(counter, which) === Math.floor(value);
  }
  else if (op === '!=') {
    return this.getData(counter, which) !== Math.floor(value);
  }
  throw 'Invalid Rule';
};

FloodWarning.prototype.checkConditions = function () {
  var self = this;
  if (config.fail) {
    config.fail.forEach(function (rule) {
      if (self.matchRule(rule)) {
        process.stderr.write('Failure: Condition met ['+rule+']\n');
        process.exit(2);
      }
    });
  }
  if (config.warn) {
    config.warn.forEach(function (rule) {
      if (self.matchRule(rule)) {
        process.stderr.write('Warning: Condition met ['+rule+']\n');
      }
    });
  }
};

FloodWarning.prototype.producePlotData = function () {
  var self = this;
  if (config.plot) {
    var names = [];
    var values = [];
    var name;
    for (name in config.plot) {
      if (config.plot.hasOwnProperty(name)) {
        var parts = config.plot[name].split(' ', 2);
        if (parts.length !== 2) {
          throw 'Invalid Plot';
        }
        names.push(name);
        values.push(self.getData(parts[0], parts[1]).toString());
      }
    }
  }
  process.stdout.write(names.join(',')+'\n');
  process.stdout.write(values.join(',')+'\n');
};

// vim:ft=javascript:et:sw=2:ts=2:sts=2:
