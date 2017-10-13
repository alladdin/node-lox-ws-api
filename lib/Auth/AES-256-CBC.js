const crypto = require('crypto');
const constants = require('constants');
const http = require('http');
const MessageText = require('../Message/Text.js');

var AES = function (host, username, password, connection, api) {
    this._host = host;
    this._username = username;
    this._password = password;
    this._connection = connection;
    this._api = api;
    this._hmac_hash = '';

    this._public_key = '';
    this._iv = crypto.randomBytes(16);
    this._key = crypto.createHash('sha256').update(crypto.randomBytes(16).toString('hex')).digest();
    this._session_key;

    this._salt_bytes = 16;
    this._current_salt = this._get_salt();
    this._salt_usage_count = 0;
    this._max_salt_usage = 20;
    this._max_salt_time = 30*1000;
    this._next_salt_time = (new Date()).getTime() + this._max_salt_time;
};

AES.prototype.__proto__ = require('events').EventEmitter.prototype;

AES.prototype.authorize = function() {
    this._register_enc_response();
    this._get_public_key();
};

AES.prototype._enc_command = function(command) {
    var salt_part = 'salt/'+(this._current_salt);
    if (this._is_new_salt_needed()){
        salt_part = 'nextSalt/'+(this._current_salt)+'/';
        this._current_salt = this._get_salt();
        salt_part += (this._current_salt);
    }
    var enc_part = this._cipher(salt_part + '/' + command, 'base64');

    return 'jdev/sys/enc/'+encodeURIComponent(enc_part);
}

AES.prototype._is_new_salt_needed = function(){
    if (this._salt_usage_count <= 0) {
        this._next_salt_time = (new Date()).getTime() + this._max_salt_time;
    }
    this._salt_usage_count++;
    if (
        (this._salt_usage_count >= this._max_salt_usage)
        || (this._next_salt_time < (new Date()).getTime())
    ){
        this._salt_usage_count = 0;
        return true;
    }
    return false;
}

AES.prototype.prepare_control_command = function(control, command) {
    var prefix = 'jdev/sps/io/';

    if (this._hmac_hash){
        prefix = 'jdev/sps/ios/'+this._hmac_hash+'/';
    }

    return this._enc_command(prefix + control + '/' + command);
};

AES.prototype.prepare_secure_command = function(command) {
    return this._enc_command(command);
}

AES.prototype._get_public_key = function() {
    var that = this;

    http.get('http://'+this._host+'/jdev/sys/getPublicKey', (res) => {
        res.on('data', (chunk) => {
            that._parse_public_key(chunk);
            that._generate_session_key();
        });
        res.resume();
    }).on('error', (e) => {
        that.emit('auth_failed', e.message);
    });
};

AES.prototype._parse_public_key = function(content) {
    var data = JSON.parse(content);
    var key = data.LL.value.replace(/CERTIFICATE/g, 'PUBLIC KEY');
    key = key.replace(/^(-+BEGIN PUBLIC KEY-+)(\w)/, '$1\n$2');
    key = key.replace(/(\w)(-+END PUBLIC KEY-+)$/, '$1\n$2');
    this._public_key = {
        'key': key,
        'padding': constants.RSA_PKCS1_PADDING
    };
};

AES.prototype._generate_session_key = function() {
    this._session_key = crypto.publicEncrypt(this._public_key, new Buffer(this._key.toString('hex')+':'+this._iv.toString('hex')));
    this._register_keyexchange_response();
    this._connection.send('jdev/sys/keyexchange/'+this._session_key.toString('base64'));
};

AES.prototype._register_keyexchange_response = function() {
    var that = this;
    this._api.command_chain.push({
        'control': /^j?dev\/sys\/keyexchange\//,
        'callback': function(loxone_message) {
            var key = new Buffer(that._decipher(loxone_message.value), 'hex').toString('utf8');
            var hmac = crypto.createHmac('sha1', key);
            var hmac_hash = hmac.update(that._username+':'+that._password).digest('hex');
            that._hmac_hash = hmac_hash;
            var enc_data = that._cipher(that._hmac_hash+'/'+that._username, 'base64');
            that._register_authenticateenc_response();
            that._connection.send('authenticateEnc/'+enc_data);
        },
        'onetime': true,
    });
};

AES.prototype._register_authenticateenc_response = function() {
    var that = this;
    this._api.command_chain.push({
        'control': /^authenticateEnc\//,
        'callback': function(loxone_message) {
            if (loxone_message.code === '200'){
                that.emit('authorized');
            }else{
                that.emit('auth_failed', loxone_message);
            }
        },
        'onetime': true,
    });
};

AES.prototype._register_enc_response = function() {
    var that = this;
    this._api.command_chain.push({
        'control': /^jdev\/sys\/enc\//,
        'callback': function(loxone_message) {
            if (loxone_message.code === '200'){
                var dec_message = new MessageText(JSON.stringify(loxone_message.data));
                var dec_control = that._decipher(decodeURIComponent(loxone_message.control.substr(13)));
                dec_control = dec_control.replace(/^salt\/[^\/]*\//, "");
                dec_control = dec_control.replace(/^nextSalt\/[^\/]*\/[^\/]*\//, "");
                dec_control = dec_control.replace(/^jdev\//, "dev/");
                dec_message.control = dec_control;
                that.emit('message_text', dec_message);
            }
        },
    });
};

AES.prototype._decipher = function(enc_data) {
    var decipher = crypto.createDecipheriv('aes-256-cbc', this._key, this._iv);
    decipher.setAutoPadding(false);
    var data = decipher.update(enc_data,'base64','utf-8');
    data += decipher.final('utf-8');
    return data.replace(/\x00.*$/,"");
};

AES.prototype._cipher = function(data, out_enc) {
    var cipher = crypto.createCipheriv('aes-256-cbc', this._key, this._iv);
    var enc_data = cipher.update(data + "\0",'utf-8', out_enc);
    enc_data += cipher.final(out_enc);
    return enc_data;
};

AES.prototype._get_salt = function() {
    return encodeURIComponent(crypto.randomBytes(this._salt_bytes).toString('hex'));
};

module.exports = AES;
