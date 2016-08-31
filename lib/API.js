const crypto = require('crypto');
const Connection = require('./Connection.js');

/*
    Events:
        auth_failed
        authorized
        close
        close_failed
        connect
        connect_failed
        connection_error
        send
        message_header
        message_text
        message_file
        message_event_table_values
        message_event_table_text
        message_event_table_daytimer
        message_event_table_weather
        message_invalid
        keepalive
        get_structure_file
        update_event
*/

var API = function (host, username, password, reconnect) {
    this._host = host;
    this._username = username;
    this._password = password;
    this._reconnect = reconnect;
    this._reconnect_timeout = undefined;
    this._reconnect_time = 2000;
    this._abort = true;
    this._authorized = false;
    this._command_chain = [];
    this._file_chain = [];
    this.register_auth_chain();
    this.hmac_hash = '';
    this.connection = undefined;
};

API.prototype.__proto__ = require('events').EventEmitter.prototype;

API.prototype.connect = function() {
    var connection = new Connection(this._host);
    this.register_connection(connection);
    connection.connect();
};

API.prototype.close = function() {
    if (this.connection !== undefined){
        this.connection.close();
    }else{
        this.emit('close_failed');
    }
};

API.prototype.abort = function() {
    clearTimeout(this._reconnect_timeout);
    this._abort = true;
    this.close();
};

API.prototype.register_connection = function(connection) {
    var that = this;
    this.connection = connection;

    this.connection.on('close', function(out_of_service) {
        that.connection = undefined;
        that._authorized = false;
        that._status_update_subscription = false;
        that.emit('close');
        if (that._abort){
            that._abort = true;
            that.emit('abort');
        }else{
            if (that._reconnect) {
                setTimeout(function(){
                    that.connect();
                }, that._reconnect_time);
            }
        }
    });

    this.connection.on('close_failed', function() {
        that.emit('close_failed');
    });

    this.connection.on('connect', function() {
        that.emit('connect');
        that._authorized = false;
        that._status_update_subscription = false;
        that.connection.send('jdev/sys/getkey');
    });

    this.connection.on('connect_failed', function() {
        that.emit('connect_failed');
    });

    this.connection.on('connection_error', function(error) {
        that.emit('connection_error');
    });

    this.connection.on('send', function(message) {
        that.emit('send', message);
    });

    this.connection.on('handle_message', function(message) {
        that.emit('handle_message', message);
    });

    this.connection.on('message_header', function(message) {
        that.emit('message_header', message);
    });

    this.connection.on('message_text', function(message) {
        that._message_text(message);
        that.emit('message_text', message);
    });

    this.connection.on('message_file', function(message) {
        that._message_file(message);
        that.emit('message_file', message);
    });

    this.connection.on('message_event_table_values', function(messages) {
        messages.forEach(function(evt){
            that.emit('update_event', evt.uuid.string, evt.value);
        });
        that.emit('message_event_table_values', messages);
    });

    this.connection.on('message_event_table_text', function(messages) {
        messages.forEach(function(evt){
            that.emit('update_event', evt.uuid.string, evt.text);
        });
        that.emit('message_event_table_text', messages);
    });

    this.connection.on('message_event_table_daytimer', function(messages) {
        messages.forEach(function(evt){
            that.emit('update_event', evt.uuid.string, evt);
        });
        that.emit('message_event_table_daytimer', messages);
    });

    this.connection.on('message_event_table_weather', function(messages) {
        messages.forEach(function(evt){
            that.emit('update_event', evt.uuid.string, evt);
        });
        that.emit('message_event_table_weather', messages);
    });

    this.connection.on('message_invalid', function(message) {
        that.emit('message_invalid', message);
    });

    this.connection.on('keepalive', function(time) {
        that.emit('keepalive', time);
    });
};

API.prototype.send_cmd = function(uuidAction, command) {
    var prefix = 'jdev/sps/ios/'+this.hmac_hash+'/';
    this.connection.send(prefix + uuidAction + '/' + command);
};

API.prototype._message_text = function(message) {
    this._command_chain.some(function(item) {
        if (message.control.match(item.control)){
            item.callback(message);
            return true;
        }else{
            return false;
        }
    });
};

API.prototype._message_file = function(message) {
    this._file_chain.some(function(item) {
        if (message.filename.match(item.file)){
            item.callback(message);
            return true;
        }else{
            return false;
        }
    });
};

API.prototype.register_auth_chain = function() {
    var that = this;
    this._command_chain.push({
        'control': /^j?dev\/sys\/getkey$/,
        'callback': function(loxone_message) {
            var key = new Buffer(loxone_message.value, 'hex').toString('utf8');
            var hmac = crypto.createHmac('sha1', key);
            var hmac_hash = hmac.update(that._username+':'+that._password).digest('hex');
            that.hmac_hash =hmac_hash;
            that.connection.send('authenticate/'+hmac_hash);
        },
    });
    this._command_chain.push({
        'control': /^authenticate\//,
        'callback': function(loxone_message) {
            if (loxone_message.code === '200'){
                that._abort = false;
                that._authorized = true;
                that.connection.send('jdev/sps/LoxAPPversion3');
                that.emit('authorized');
            }else{
                that.emit('auth_failed', loxone_message);
            }
        },
    });
    this._command_chain.push({
        'control': /^j?dev\/sps\/LoxAPPversion3$/,
        'callback': function(loxone_message) {
            that.connection.send('data/LoxAPP3.json');
        },
    });
    this._file_chain.push({
        'file': /^data\/LoxAPP3.json/,
        'callback': function(loxone_file) {
            that.emit('get_structure_file', loxone_file.data);
            if (!that._status_update_subscription) {
                that._status_update_subscription = true;
                that.connection.send('jdev/sps/enablestatusupdate');
            }
        },
    });
};

module.exports = API;
