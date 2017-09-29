
var Text = function (utf8Data) {
    var json;

    try {
        json = JSON.parse(utf8Data);
        this.type = 'json';
        this.data = json;
        if (json.LL && json.LL.control) {
            this.type = 'control';
            this.control = json.LL.control;
            this.value = json.LL.value;
            this.code = json.LL.Code;
            if (this.code === undefined){
                this.code = json.LL.code;
            }
        }
    } catch(e) {
        this.type = 'text';
        this.data = utf8Data;
    }
};

module.exports = Text;
