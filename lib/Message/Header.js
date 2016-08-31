
var Header = function (binaryData) {
    this.bin_type = binaryData.readUInt8(0);
    this.identifier = binaryData.readUInt8(1);
    this.info = binaryData.readUInt8(2);
    this.len = binaryData.readUInt32LE(4);
};

Header.prototype.next_state = function() {
    if (this.info & 0x80){
        return 'header';
    }
    switch (this.identifier){
        case 0:
            return 'text';
        case 1:
            return 'binary_file';
        case 2:
            return 'etable_values';
        case 3:
            return 'etable_text';
        case 4:
            return 'etable_daytimer';
        case 5: // out_of_service
            return 'header';
        case 6: // keepalive
            return 'header';
        case 7:
            return 'etable_weather';
        default:
            return 'header';
    }
};

module.exports = Header;
