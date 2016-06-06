var GRF = require('./index.js');

var path = require('path');

console.time('loadGRF');
var grf = new GRF();

var filename = 'E:\\Downloads\\Ragnarok Online\\Client\\data.grf'; //'E:\\grfoutput\\test_0x200.grf'
grf.open(filename, {}, function(err, grf) {
	if (err) {
		console.error(err);
		return;
	}

	//console.log('File Count: '+grf.header.getFileCount());

	grf.readFileTable(grf_headerReadCallback);
});


function grf_headerReadCallback(err, grf) {

	if (err) {
		console.error(err);
		return;
	}

	console.timeEnd('loadGRF');
	//console.log(grf);

	if (grf.files.length>0) {
		for (var i=0; i<grf.files.length;i++) {
			console.log(i+'. '+grf.files[i].name);
			var filename = grf.files[i].name;
			if (path.extname(filename) === ".txt") {
				console.log('Reading file: '+filename);	
				grf.readFile(filename, function(err, buffer){
					if (err) {
						console.error(err);
						return;
					}

					console.log(buffer.toString());
				});
			}
		}

		//E:\grfextract
	}
}


// Change Types
// Delete
// Update in place (Content is <= origional content)
// Update in different place (content is > origional content)
// Batch updates in different place to grow out the file

// Defragment/Repack
// Take any deleted records and gaps and remove the gaps.

// Calculate fragmentation as a % of total file size.
// If Data is > certian amount suggest a defragment/repack operation be taken.