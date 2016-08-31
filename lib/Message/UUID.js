
var UUID = function (binaryData, offset) {
    var data1 = binaryData.slice(offset + 0, offset + 4);
    var data2 = binaryData.slice(offset + 4, offset + 6);
    var data3 = binaryData.slice(offset + 6, offset + 8);
    var data4 = binaryData.slice(offset + 8, offset + 16);

    data1.swap32();
    data2.swap16();
    data3.swap16();

    this.string
        = data1.toString('hex') + '-'
        + data2.toString('hex') + '-'
        + data3.toString('hex') + '-'
        + data4.toString('hex');

    this.data_length = 16;
};

module.exports = UUID;
