const UUID = require('./UUID.js');

var EventDaytimer = function (binaryData, offset) {
    var offset_add = offset;
    this.uuid = new UUID(binaryData, offset_add);
    offset_add += this.uuid.data_length;
    this.defValue = binaryData.readDoubleLE(offset_add);
    offset_add += 8;
    this.entries = binaryData.readInt32LE(offset_add);
    offset_add += 4;

    this.entry = [];

    for (var i=0; i<this.entries; i++){
        this.entry.push({
            'mode': binaryData.readInt32LE(offset_add),
            'from': binaryData.readInt32LE(offset_add + 4),
            'to': binaryData.readInt32LE(offset_add + 8),
            'needActivate': binaryData.readInt32LE(offset_add + 12),
            'value': binaryData.readDoubleLE(offset_add + 16)
        });
        offset_add += 24;
    }

    this.data_length = this.uuid.data_length + 8 + 4 + this.entries * 24;
};

function formatMinutes(minutes){
    var hour = ('00' + Math.floor(minutes/60)).slice(-2);
    var minute = ('00' + (minutes % 60)).slice(-2);
    return hour+':'+minute;
}

EventDaytimer.prototype.toString = function() {
    var string = '{defValue: '+this.defValue+', entries: '+this.entries+', entry: [\n'
    for (var i=0; i<this.entries; i++){
        var entry = this.entry[i];
        string += '{mode: '+entry.mode;
        string += ', from: '+formatMinutes(entry.from);
        string += ', to: '+formatMinutes(entry.to);
        string += ', needActivate: '+entry.needActivate;
        string += ', value: '+entry.value;
        string += '}\n';
    }
    string += '], uuid: '+this.uuid.string +'}';
    return string;
};

module.exports = EventDaytimer;

