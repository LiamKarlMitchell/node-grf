'use strict';

var fs = require('fs');
var zlib = require('zlib');

var GRFHeader = require('./GRFHeader.js');
var GRFFile = require('./GRFFile.js');

var encoding = require("encoding");

var hexy = require('hexy').hexy;

/**
 * Representation a of grf file in js
 * @constructor
 */
function GRF() {
    // if this constructor is used without `new`, it adds `new` before itself:
    if (!(this instanceof GRF)) {
        return new GRF();
    }

    this.header = new GRFHeader();

    // object containing the files :
    // {
    //   "folder/" : {...},
    //   "folder/data.txt" : {...}
    // }
    this.files = [];

    this.comment = null;

    this.clone = function() {
        var newObj = new GRF();
        for (var i in this) {
            if (typeof this[i] !== "function") {
                newObj[i] = this[i];
            }
        }
        return newObj;
    };
}

// This function does nothing on purpose.
function NOP() {};

GRF.prototype = {
    // Opens a file handle for read+write.
    // Also reads the header.
    open: function GRF__open(filename, options, callback) {
        if (callback === undefined && typeof options === 'function') {
            callback = options;
            options = {};
        }

        if (options.loadHeader === undefined) {
            options.loadHeader = true;
        }

        if (callback === undefined) {
            callback = NOP;
        }

        var grf = this;

        this.fd_mode = '';

        if (this.fd) {
            fs.close(fd);
            fd = null;
        }

        fs.open(filename, 'r', function(err, fd) {
            if (err) {
                return callback(err);
            }

            grf.fd = fd;
            grf.fd_mode = 'r';

            if (options.loadHeader) {
                grf.readHeader(callback);
            } else {
                callback(null, grf);
            }
        });
    },

    readHeader: function GRF__readHeader(callback) {
        if (!this.fd) {
            return callback('FileDescriptor not open.');
        }

        var grf = this;
        var headerBuffer = new Buffer(46);
        fs.read(this.fd, headerBuffer, 0, 46, 0, function onHeaderBytes(err, bytesRead, buffer) {
            if (err) {
                return callback(err);
            }

            // TODO: Make this async
            try {
                grf.header.readSync(buffer);
                callback(null, grf);
            } catch (e) {
                callback(e);
            }
        });
    },

    readFileTable: function GRF__readFileTable(callback) {
        if (!this.fd) {
            return callback('FileDescriptor not open.');
        }

        var fileTable = [];

        var grf = this;
        var fileTableSizeBuffer = new Buffer(8);
        fs.read(this.fd, fileTableSizeBuffer, 0, 8, 46 + this.header.fileTableOffset, function onFileTableSizeBytes(err, bytesRead, buffer) {
            if (err) {
                return callback(err);
            }

            grf.compressedFileTableSize = buffer.readUInt32LE(0);
            grf.fileTableSize = buffer.readUInt32LE(4);

            var fileTableBuffer = new Buffer(grf.compressedFileTableSize);
            fs.read(grf.fd, fileTableBuffer, 0, grf.compressedFileTableSize, 46 + grf.header.fileTableOffset + 8, function onFileTableBytes(err, bytesRead, buffer) {
                if (err) {
                    return callback(err);
                }

                zlib.unzip(buffer, function onFileTableUnzip(err, buffer) {
                    if (err) {
                        return callback(err);
                    }

                    //TODO Optimize this maybe

                    var files = grf.files;
                    files.length = 0;
                    var filenameIndex = {};
                    grf.filenameIndex = filenameIndex;
                    var fileCount = grf.header.getFileCount();

                    //TODO Calculate fragmentation of the archive.
                    var fragmentation = 0;

                    var position = 0;

                    var file = null;
                    for (var i = 0; i < fileCount; i++) {

                        // Find the 00 byte to terminate the name.
                        if (file === null) {
                            var remainingNameLength = buffer.length - position - 17;
                            var lookPosition;
                            for (var j = 0; j < remainingNameLength; j++) {
                                lookPosition = position + j;
                                if (buffer.readUInt8(lookPosition) === 0x00) {
                                    // TODO Maybe use korean encoding?
                                    var name = buffer.toString('utf8', position, lookPosition);

                                    // Encode from Korean into UTF8.
                                    //name = encoding.convert(name, 'UTF-8', 'EUC-KR').toString();

                                    position = lookPosition + 1;

                                    //console.log(hexy(buffer.slice(position)));

                                    var compressedSize = buffer.readUInt32LE(position);
                                    position += 4;
                                    var alignedSize = buffer.readUInt32LE(position);
                                    position += 4;
                                    var size = buffer.readUInt32LE(position);
                                    position += 4;
                                    var type = buffer.readUInt8(position);
                                    position += 1; // Type is a bitwise flag.
                                    var offset = buffer.readUInt32LE(position);
                                    position += 4;

                                    // TODO Warn about invalid type?
                                    // 0x01 is file
                                    // 0x02 and 0x04 are encrypted files

                                    if (size === 0 || !(
                                            type & 0x01 ||
                                            type & 0x02 ||
                                            type & 0x04
                                        )) {
                                        break;
                                    }

                                    // TODO Add empty entries to a list of re-useable file entry bytes?
                                    // TODO Use empty entries to increase fragmentation size.

                                    file = new GRFFile(name);

                                    file.size = size;
                                    file.compressedSize = compressedSize;
                                    file.alignedSize = alignedSize;
                                    file.type = type;
                                    file.offset = offset;

                                    break;
                                }
                            }

                            if (file !== null) {
                                files.push(file);

                                // Lowercase the name because searches are case insenitive.
                                // 
                                //  TODO Warning about duplicated file name?
                                filenameIndex[file.name.toLowerCase()] = file;
                                file = null;
                            }

                            // TODO Handle unable to read file table entry?
                        }

                        // Some way to issue warnings?

                    }

                    callback(null, grf);
                });

            });
        });


    },

    // Callback will return err and file data.
    readFile: function GRF__readFile(filename, cache, callback) {
        var file = null;
        // Treat as index if is a number.
        if (!isNaN(filename)) {
            file = this.files[filename];
        } else {
            file = this.filenameIndex[filename.toLowerCase()];
        }

        if (cache instanceof Function && !callback) {
            callback = cache;
            cache = false;
        }

        if (!file) {
            callback('File "' + filename + '" not found.');
            return;
        }

        // TODO Cache on file offset?
        var lcname = file.name.toLowerCase();
        if (cache && this.__cache[lcname]) {
            callback(null, this.__cache[lcname]);
            return;
        }

        var grf = this;
        var fileBuffer = new Buffer(file.alignedSize);
        fs.read(grf.fd, fileBuffer, 0, file.alignedSize, 46 + file.offset, function onFileBytes(err, bytesRead, buffer) {
            if (err) {
                return callback(err);
            }

            if (!(file.type & 0x01)) {
                callback('File type is not supported.');
                return;
            }

            zlib.unzip(buffer, function onFileUnzip(err, buffer) {
                if (err) {
                    return callback(err);
                }

                if (cache) {
                    grf.__cache[lcname] = buffer;
                }
                callback(null, buffer);

            });
        });

    }



    // loadFromBuffer: function GRF__loadFromBuffer(buffer, callback) {

    // }
};


// TODO Handle writing
// Deletes first

module.exports = GRF;