var Command = require('./commands');

var userCMD = require('./UserCMD');

var validate = require('./validation');

module.exports = function(io, db, socket){

    var ip = socket.conn.remoteAddress

    function log(string){
        var id = pad(5, "", " ");
        var username = pad(8, "", " ");
        var command = pad(48, string, " ");
        console.log(id + " " + username + " " + command + " "  + ip);
    }

    function pad(width, string, pad) {
        var padding = "";
        for(var i = 0; i < width; i++){
            padding += pad;
        }
        return (string + padding).substr(0, width);
    }

    log("new connection")

    socket.on("disconnect", function(){
        log("lost connection")
    });

    socket.on("ping", function(callback){
        callback();
    });

    socket.on(Command.REGISTER, function(data, callback){
        var username = data.username;
        var email = data.email;
        var password = data.password;
        log(Command.REGISTER + " u: " + username);
        if(validate.validateEmail(email)){
            db.register(username, email, password, function(data){
                callback(data);
            });
        }else{
            callback({succ: false, err: "Invalid email address"})
        }
    });

    socket.on(Command.LOGIN, function(data, callback){
        var username = data.username;
        var password = data.password;
        log(Command.LOGIN + " u: " + username)
        db.login(username, password, function(data){
            if(socket.user == null){
                callback(data);
                if(data.succ){
                    socket.user = data;
                    userCMD(io, db, socket);
                }
            }else{
                callback({succ: false, err: "You are already logged in"})
            }
        });
    });

    socket.on(Command.LOGIN_SESSION, function(sessionId, callback){
        log(Command.LOGIN_SESSION + " id: " + sessionId)
        if(socket.user == null){
            db.loginSession(sessionId, function(data){
                callback(data);
                if(data.succ){
                    socket.user = data;
                    userCMD(io, db, socket);
                }
            });
        }else{
            callback({succ: false, err: "You are already logged in"})
        }
    });
}