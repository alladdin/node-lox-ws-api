const UUID = require('./UUID.js');

var EventWeather = function (binaryData, offset) {
    var offset_add = offset;
    this.uuid = new UUID(binaryData, offset_add);
    offset_add += this.uuid.data_length;
    this.lastUpdate = binaryData.readUInt32LE(offset_add);
    offset_add += 4;
    this.entries = binaryData.readInt32LE(offset_add);
    offset_add += 4;

    this.entry = [];

    for (var i=0; i<this.entries; i++){
        this.entry.push({
            'timestamp': binaryData.readInt32LE(offset_add),
            'weatherType': binaryData.readInt32LE(offset_add + 4),
            'windDirection': binaryData.readInt32LE(offset_add + 8),
            'solarRadiation': binaryData.readInt32LE(offset_add + 12),
            'relativeHumidity': binaryData.readInt32LE(offset_add + 16),
            'temperature': binaryData.readDoubleLE(offset_add + 20),
            'perceivedTemperature': binaryData.readDoubleLE(offset_add + 28),
            'dewPoint': binaryData.readDoubleLE(offset_add + 36),
            'precipitation': binaryData.readDoubleLE(offset_add + 44),
            'windSpeed': binaryData.readDoubleLE(offset_add + 52),
            'barometricPressure': binaryData.readDoubleLE(offset_add + 60)
        });
        offset_add += 68;
    }

    this.data_length = this.uuid.data_length + 4 + 4 + this.entries * 68;
};

EventWeather.prototype.toString = function() {
    var string = '{lastUpdate: '+this.lastUpdate+', entries: '+this.entries+', entry: [\n'
    for (var i=0; i<this.entries; i++){
        var entry = this.entry[i];
        string += '{timestamp: '+entry.timestamp;
        string += ', weatherType: '+entry.weatherType;
        string += ', windDirection: '+entry.windDirection;
        string += ', solarRadiation: '+entry.solarRadiation;
        string += ', relativeHumidity: '+entry.relativeHumidity;
        string += ', temperature: '+entry.temperature;
        string += ', perceivedTemperature: '+entry.perceivedTemperature;
        string += ', dewPoint: '+entry.dewPoint;
        string += ', precipitation: '+entry.precipitation;
        string += ', windSpeed: '+entry.windSpeed;
        string += ', barometricPressure: '+entry.barometricPressure;
        string += '}\n';
    }
    string += '], uuid: '+this.uuid.string +'}';
    return string;
};

module.exports = EventWeather;

