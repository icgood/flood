
var Module = require("module").Module;
    
function rawRequire(code, filename) {
  var cachedModule = Module._cache[filename];

  if (cachedModule) {
    return cachedModule.exports;
  }
  
  var mod = new Module(filename, module);
  Module._cache[filename] = mod;
  
  mod.filename = filename;
  
  mod._compile(code, filename);
  mod.loaded = true;
  
  return mod.exports;
}

exports.rawRequire = rawRequire;

// vim:et:sts=2:sw=2:ts=2
