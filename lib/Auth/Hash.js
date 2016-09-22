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

Hash.prototype.prepare_command = function(uuidAction, command) {
    var prefix = 'jdev/sps/ios/'+this._hmac_hash+'/';
    return prefix + uuidAction + '/' + command;
};

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
                    that.emit('authorized');
                }else{
                    that.emit('auth_failed', loxone_message);
                }
            },
        }
    ];
};

module.exports = Hash;
