// Variables
var express = require('express'),
    bodyParser = require('body-parser'),
    methodOverride = require('method-override'),
    morgan = require('morgan'),
    http = require('http'),
    path = require('path'),
    fs = require('fs'),
    propsReader = require('properties-reader'),
    port = 3000,
    server = express(),
    passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    DEFAULT_PORT = 3000,
    DEFAULT_THEME = "superhero",
    DEFAULT_AVATAR = "http://www.lezebre.lu/images/21913-scooby-doo-mystery-machine-fleur.png",
    mongo = require('mongodb'),
    bb = require("bluebird"),
    scp = require("scp"),
    log4js = require("log4js"),
    zlib = require("zlib"),
    stream = require("stream");

var authenticatedUser = 'jakparks';

// Configure Logging including mogran for all HTTP requests
log4js.configure({
    appenders: [
        { type: 'file', filename: '/apps/var/log/nodejs/admin.log', category: 'logAnalyzer', 'maxLogSize': 1000000, 'backups': 10 }
    ]
});
log4js.replaceConsole();
var logger = log4js.getLogger('logAnalyzer');
var theHTTPLog = morgan("tiny", {
  "stream": {
    write: function(str) { logger.info(str); }
  }
});
server.use(theHTTPLog);

// Server setup
var ObjectID = require('mongodb').ObjectID;
server.use(bodyParser.json());
server.use("/bower_components", express.static(__dirname + "/client/bower_components")); // Treat all bower_components requests as static content
server.use("/logAnalyzer*", function(req, res, next) { // Send these request to the main index.html to be routed by Angular
    res.sendFile(__dirname + "/index.html");
});
server.use("/client", express.static(__dirname + "/client")); // Treat all client requests as static content
server.use(function(req, res, next) {
    next();
});


// Mongodb promises
bb.promisifyAll(mongo);
bb.promisifyAll(mongo.Db.prototype);
bb.promisifyAll(mongo.Collection.prototype);


// Global values
// Page size
var PAGE_SIZE = 15;

server.listen(DEFAULT_PORT, function() {
  logger.info("Server listening");
})
// ********************************** common routines start here ***********************************************

function connectToDb(wait, database) {
   logger.info("connectToDb: database=" + database);
   mongo.connectAsync(database).then(function(conn) {
	  logger.info("Connected and authenticated.");
	  wait.resolve(conn);
   }).catch(function(e){
	logger.error("Error connecting to the database. " + e);
        setTimeout(function () {
	   connectToDb(wait, database);
        }, 5000);
   });
   return wait.promise;
}

function writeResponse(res, status, result) {
   var response = {
       "status": status,
       "result": result
   };
   logger.info("Response to client: " + JSON.stringify(response));
   res.writeHead(200, {
       'Content-Type': 'application/json'
   });
   res.write(JSON.stringify(response));
   res.end();
}

function writeResponse(res, status, result, cnt, startIndex, numRecords) {
   var response = {
       "status": status,
       "result": result,
       "totalRecords" : cnt,
       "startIndex" : startIndex,
       "pageSize" : PAGE_SIZE,
       "numRecords" : numRecords
   };
   logger.info("Response to client: " + JSON.stringify(response));
   res.writeHead(200, {
       'Content-Type': 'application/json'
   });
   res.write(JSON.stringify(response));
   res.end();
}


// ********************************** routes start here ***********************************************
server.get('/getFiles', function(req, res) {
  var fileName = req.query.file;
  logger.info('Downloading files name: ' + fileName);
  scp.get({
    file: '/apps/var/log/cmsp/' + fileName,
    user: authenticatedUser,
    host: 'tsmapapp-dev-01',
    port: '22',
    path: './Logs/node1'
  }, function(err) {
    if(err) {
      logger.info("Error downloading from node 1");
      writeResponse(res, "Error", 'Unable to pull logs for this date.');
      return;
    }
    scp.get({
      file: '/apps/var/log/cmsp/' + fileName,
      user: authenticatedUser,
      host: 'tsmapapp-dev-02',
      port: '22',
      path: './Logs/node2'
    }, function(err) {
      if(err) {
        logger.info("Error downloading from node 2");
        writeResponse(res, "Error", 'Unable to pull logs for this date.');
        return;
      } else {
        logger.info('Success Downloading');
      }

      //If this is an uncompressed file, skip the unzip.
      if(fileName == "cmsp.log") {
        combineAndSendFiles(fileName, res, function() {
          cleanDirectories();
          return;
        });
      } else {
      //Unzip compressed logs (any that are not from today)
      unzip(fileName, function() {
        logger.info('Finished unzip.');

        fileName = fileName.split('.')[0];
        combineAndSendFiles(fileName, res, function() {
          cleanDirectories();
        });
      });
    }
    });
  });

});

//Unzip each gzip file
var unzip = function(fileName, callback) {
  logger.info('Unzipping');
  try {
  var gzip = zlib.createGunzip();
  var inp = fs.createReadStream('./Logs/node1/' + fileName);
  var out = fs.createWriteStream('./Logs/node1/' + fileName.split('.')[0]);

  inp.pipe(gzip).pipe(out).on('close', function() {
    logger.info('Node 1 unzipped.');
    var inp2 = fs.createReadStream('./Logs/node2/' + fileName);
    var out2 = fs.createWriteStream('./Logs/node2/' + fileName.split('.')[0]);
    var gzip2 = zlib.createGunzip();

    inp2.pipe(gzip2).pipe(out2).on('close', function() {
      logger.info("Node 2 unzipped.");
      logger.info('Success unzipping');
      callback();
    });
  });

} catch(err) {
  logger.info('Error unzipping: ' + err);
}
}

var combineAndSendFiles = function(fileName, res, callback) {
  logger.info('Combining log files.');
  var splitRegex = /\n (?:(?=\d*-\d*-\d*))/;
  var outFile = fs.openSync('./Logs/out/out.log', 'w+');

  fs.readFile('./Logs/node1/' + fileName, 'utf8', function(err, data) {
    logger.info('File 1 read.');
    if(err) {
      logger.info(err);
      return;
    }
    var splitFile = data.split(splitRegex);
    fs.readFile('./Logs/node2/' + fileName, 'utf8', function(err, data) {
      logger.info('File 2 read.');
      if(err) {
        logger.info(err);
        return;
      }
      var splitFile2 = data.split(splitRegex);

        //Combine the contents of both files
        splitFile = splitFile.concat(splitFile2);

        logger.info('Sorting files.');
        //Sort by timestamp descending
        splitFile.sort(function(a, b) {
          //Move all empty lines (will have 1 space like every other line) to the end
          if(a == ' ') {
            return 1;
          } else if(b == ' ') {
            return -1;
          }
          //Get the date from a nonempty line
          var timeIndexEndA = a.indexOf('|');
          var timeIndexEndB = b.indexOf('|');

          var timeA = a.slice(0, timeIndexEndA).split(' ')[1].replace('.', ':').split(':');
          var timeB = b.slice(0, timeIndexEndB).split(' ')[1].replace('.', ':').split(':');

          //Compare hours, then minutes, seconds, millis.  If all are equal, return 0
          for(i = 0; i < timeA.length; i++) {
            if(parseInt(timeA[i]) > parseInt(timeB[i])) {
              return -1;
            } else if(parseInt(timeA[i]) < parseInt(timeB[i])) {
              return 1
            }

          }
          return 0;
        });
        logger.info('Responding to client.');
        var s = new stream.Readable;

        for(var i = 0; i < splitFile.length; i++) {
          s.push(splitFile[i] + '\n');
        }
        s.push(null);
        var deflateZip = zlib.createDeflate();
        res.set({
          'Content-Encoding': 'deflate',
          'Content-Type': 'text/javascript'
        });
        s.pipe(deflateZip).pipe(res);
        callback();
    });
  });
};

var cleanDirectories = function() {
  var node1Files = fs.readdirSync('./Logs/node1');
  var node2Files = fs.readdirSync('./Logs/node2');
  for(var i = 0; i < node1Files.length; i++) {
    fs.unlinkSync('./Logs/node1/' + node1Files[i]);
  }
  for(var i = 0; i < node2Files.length; i++) {
    fs.unlinkSync('./Logs/node2/' + node2Files[i]);
  }
}
