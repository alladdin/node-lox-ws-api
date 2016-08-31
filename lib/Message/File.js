
var File = function (message, filename) {
    this.filename = filename;

    if (message.type !== 'binary'){
        if (filename.match(/\.json$/)) {
            this.type = 'json';
            this.data = JSON.parse(message.utf8Data);
        }else{
            this.type = 'text';
            this.data = message.utf8Data;
        }
    }else{
        this.type = 'binary';
        this.data = message.binaryData;
    }
};

module.exports = File;
