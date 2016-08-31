const UUID = require('./UUID.js');

var EventText = function (binaryData, offset) {
    var offset_add = offset;
    this.uuid = new UUID(binaryData, offset_add);
    offset_add += this.uuid.data_length;
    this.uuidIcon = new UUID(binaryData, offset_add);
    offset_add += this.uuidIcon.data_length;
    this.textLength = binaryData.readUInt32LE(offset_add);
    offset_add += 4;
    this.text = binaryData.toString('utf8',
        offset_add,
        offset_add + this.textLength
    );

    this.data_length = (Math.floor((4 + this.textLength + this.uuid.data_length + this.uuidIcon.data_length - 1)/4) + 1)*4;
};

EventText.prototype.toString = function() {
    return '{textLength: '+this.textLength+', text: '+this.text+', uuid: '+this.uuid.string+', uuidIcon: '+this.uuidIcon.string+'}';
};

module.exports = EventText;

