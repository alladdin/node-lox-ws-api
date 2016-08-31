const UUID = require('./UUID.js');

var EventValue = function (binaryData, offset) {
    this.uuid = new UUID(binaryData, offset);
    this.value = binaryData.readDoubleLE(offset + this.uuid.data_length);

    this.data_length = 8 + this.uuid.data_length;
};

EventValue.prototype.toString = function() {
    return '{value: '+this.value.toString()+', uuid: '+this.uuid.string+'}';
};

module.exports = EventValue;
