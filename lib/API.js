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

var API = function (host, username, password, reconnect, security) {
    this._host = host;
    this._username = username;
    this._password = password;
    this._reconnect = reconnect;
    this._reconnect_timeout = undefined;
    this._reconnect_time = 2000;
    this._abort = false;
    this._command_chain = [];
    this._file_chain = [];
    this._auth_class = require('./Auth/'+(security === undefined ? 'Hash' : security)+'.js');
    this._auth = undefined;
    this.connection = undefined;
};

API.prototype.__proto__ = require('events').EventEmitter.prototype;

API.prototype.connect = function() {
    var connection = new Connection(this._host);
    this.register_connection(connection);
    this.register_auth_chain();
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

API.prototype.is_connected = function() {
    return this.connection !== undefined;
}

API.prototype.register_connection = function(connection) {
    var that = this;
    if (this.connection !== undefined){
        that.emit('already_connected');
        return;
    }

    this.connection = connection;

    this.connection.on('close', that.reconnect.bind(this));
    this.connection.on('error', that.reconnect.bind(this));
    this.connection.on('connect_failed', that.reconnect.bind(this));

    this.connection.on('close_failed', function() {
        that.emit('close_failed');
    });

    this.connection.on('connect', function() {
        that.emit('connect');
        that._status_update_subscription = false;
        that._auth.authorize();
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
            that.emit('update_event_value', evt.uuid.string, evt.value);
            that.emit('update_event_value_' + evt.uuid.string, evt.value);
        });
        that.emit('message_event_table_values', messages);
    });

    this.connection.on('message_event_table_text', function(messages) {
        messages.forEach(function(evt){
            that.emit('update_event_text', evt.uuid.string, evt.text);
            that.emit('update_event_text_' + evt.uuid.string, evt.value);
        });
        that.emit('message_event_table_text', messages);
    });

    this.connection.on('message_event_table_daytimer', function(messages) {
        messages.forEach(function(evt){
            that.emit('update_event_daytimer', evt.uuid.string, evt);
            that.emit('update_event_daytimer_' + evt.uuid.string, evt.value);
        });
        that.emit('message_event_table_daytimer', messages);
    });

    this.connection.on('message_event_table_weather', function(messages) {
        messages.forEach(function(evt){
            that.emit('update_event_weather', evt.uuid.string, evt);
            that.emit('update_event_weather_' + evt.uuid.string, evt.value);
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

API.prototype.reconnect = function() {
    var that = this;
    if (that.connection != undefined){
        that.connection.removeAllListeners();
        that.connection.close();
    }
    that.connection = undefined;
    that.clear_auth_chain();
    that._status_update_subscription = false;
    that.emit('close');
    if (that._abort){
        that.emit('abort');
        return;
    }

    if (that._reconnect) {
        that.emit('reconnect');
        setTimeout(function(){
            if (that.connection === undefined){
                that.connect();
            }
        }, that._reconnect_time);
    }
};

API.prototype.send_control_command = function(control, command) {
    this.connection.send(this._auth.prepare_control_command(control, command));
};

API.prototype.send_command = function(command, secure) {
    secure = typeof secure !== 'undefined' ? secure : true;
    if (secure){
        this.connection.send(this._auth.prepare_secure_command(command));
    }else{
        this.connection.send(command);
    }
};

API.prototype.send_cmd = function(uuidAction, command) {
    this.send_control_command(uuidAction, command);
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

API.prototype.clear_auth_chain = function() {
    this._command_chain = [];
    this._file_chain = [];
    this._auth = undefined;
};

API.prototype.register_auth_chain = function() {
    var that = this;

    this._auth = new (this._auth_class)(this._host, this._username, this._password, this.connection);

    this._auth.on('auth_failed', function(loxone_message) {
        that.emit('auth_failed', loxone_message);
    });

    this._auth.on('authorized', function() {
        that._abort = false;
        that.emit('authorized');
        that.connection.send('jdev/sps/LoxAPPversion3');
    });

    this._auth.on('message_text', function(loxone_message) {
        that.emit('message_text', loxone_message);
    });

    this._command_chain = this._auth.get_command_chain();

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
                that.connection.send('jdev/sps/enablebinstatusupdate');
            }
        },
    });
};

module.exports = API;
