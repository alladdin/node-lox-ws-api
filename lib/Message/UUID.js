
var UUID = function (binaryData, offset) {
    var data1 = binaryData.slice(offset + 0, offset + 4);
    var data2 = binaryData.slice(offset + 4, offset + 6);
    var data3 = binaryData.slice(offset + 6, offset + 8);
    var data4 = binaryData.slice(offset + 8, offset + 16);

    _swap_32(data1);
    _swap_16(data2);
    _swap_16(data3);

    this.string
        = data1.toString('hex') + '-'
        + data2.toString('hex') + '-'
        + data3.toString('hex') + '-'
        + data4.toString('hex');

    this.data_length = 16;
};

function _swap_16(data){
    t = data[0];
    data[0] = data[1];
    data[1] = t;
};

function _swap_32(data){
    t = data[0];
    data[0] = data[3];
    data[3] = t;
    t = data[1];
    data[1] = data[2];
    data[2] = t;
};

module.exports = UUID;
