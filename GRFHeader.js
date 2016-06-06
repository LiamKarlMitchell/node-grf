var GRF_HEADER = "Master of Magic\0";
var GRF_HEADER_SIZE = 46;
var GRF_TABLE_SIZE = 17;

var GRF_FLAG_FILE = 1;
var GRF_FLAG_MIXCRYPT = 2;
var GRF_FLAG_DES = 4;


// struct grf_header
// {
//     char magic[16];             /// "Master of Magic" +\0
//     char key[14];  			    /// 0x01 -> 0x0E, or 0x00 -> 0x00 (no encryption)
//     uint32_t fileTableOffset;   /// The location of the file table
//     uint32_t seed;		    	/// What is the value of randomly
//     uint32_t filesCount;		/// The actual number of files = FilesCount - Seed - 7
//     uint32_t version;		    /// GRF file version: 0x102, 0x103, 0x200
// };


function GRFHeader() {
	this.magic = GRF_HEADER;
	this.key = '\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0';
	this.fileTableOffset = 1024;
	this.seed = 0;
	this.filesCount = 7; // For some unknown reason this has a value of 7 with no files.
	this.version = 0x0200;
}

GRFHeader.prototype.readSync = function GRFHeader__readSync(buffer, position) {
	position = position || 0;

	if (position + GRF_HEADER_SIZE > buffer.length) {
		throw new Error('Buffer does not accommodate the GRFHeader.');
	}

	this.magic = buffer.toString('utf8', position, position + 16);

	if (this.magic !== GRF_HEADER) {
		throw new Error('GRF Header does not match \''+GRF_HEADER+'\'');
	}

	this.key = buffer.toString('utf8', position + 16, position + 16 + 14);
	this.fileTableOffset = buffer.readInt32LE(position + 16 + 14);
	this.seed = buffer.readInt32LE(position + 16 + 14 + 4);
	this.filesCount = buffer.readInt32LE(position + 16 + 14 + 4 + 4);
	this.version = buffer.readInt32LE(position + 16 + 14 + 4 + 4 + 4);

	switch (this.version) {
		// case 0x102;
		// break;
		// case 0x103;
		// break;
		case 0x200:

		break;
		default:
		throw new Error('GRF Version '+this.version+' is not supported.');
		break;
	}
}


GRFHeader.prototype.getFileCount = function GRFHeader__getFileCount() {
	return this.filesCount - this.seed - 7;
}

module.exports = GRFHeader;
