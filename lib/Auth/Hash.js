const crypto = require('crypto');

var Hash = function (host, username, password, connection) {
    this._host = host;
    this._username = username;
    this._password = password;
    this._connection = connection;
    this._hmac_hash = '';
};

Hash.prototype.__proto__ = require('events').EventEmitter.prototype;

Hash.prototype.authorize = function() {
    this._connection.send('jdev/sys/getkey');
};

Hash.prototype.prepare_control_command = function(control, command) {
    var prefix = 'jdev/sps/io/';

    if (this._hmac_hash){
        prefix = 'jdev/sps/ios/'+this._hmac_hash+'/';
    }

    return prefix + control + '/' + command;
};

Hash.prototype.prepare_secure_command = function(command) {
    return command;
}

Hash.prototype.get_command_chain = function() {
    var that = this;
    return [
        {
            'control': /^j?dev\/sys\/getkey$/,
            'callback': function(loxone_message) {
                var key = new Buffer(loxone_message.value, 'hex').toString('utf8');
                var hmac = crypto.createHmac('sha1', key);
                var hmac_hash = hmac.update(that._username+':'+that._password).digest('hex');
                that._hmac_hash = hmac_hash;
                that._connection.send('authenticate/'+hmac_hash);
            },
        },
        {
            'control': /^authenticate\//,
            'callback': function(loxone_message) {
                if (loxone_message.code === '200'){
                    that._connection.send('jdev/cfg/version');
                }else{
                    that.emit('auth_failed', loxone_message);
                }
            }
        },
        {
            'control': /^j?dev\/cfg\/version$/,
            'callback': function(loxone_message) {
                var version = loxone_message.value.split(".");
                if (version[0] >= 9){
                    that._hmac_hash = undefined;
                }
                that.emit('authorized');
            }
        }
    ];
};

module.exports = Hash;
