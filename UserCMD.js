var Command = require('./commands')

var fs = require('fs');

var gm = require('gm');

var validate = require('./validation')

var HOUSE = "HOUSE_";

var USER = "USER_";

var ERROR = {succ: false, err: "An error has occurred"};

var SUCCESS = {succ: true}

module.exports = function(io, db, socket){

    var ip = socket.conn.remoteAddress
	ip = ip.substring(ip.lastIndexOf(":") + 1);

    socket.join(USER + socket.user.id)

    function log(string){
        var id = pad(5, socket.user.id, " ");
        var username = pad(8, socket.user.username, " ");
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

    db.getShortFavoriteList(socket.user.id, function(data){
        for(var i = 0; i < data.length; i++){
            var row = data[i];
            socket.join(HOUSE + row.house_id);
        }
    });

    socket.on("disconnect", function(){
        log("lost connection")
    });

    socket.on(Command.CHANGE_NAME, function(name, callback){
        log(Command.CHANGE_NAME + ": " + name)
        db.changeName(socket.user.id, name, function(succ){
            if(succ){
                callback({name: name, succ: true})
                socket.user.name = name;
            }else{
                callback(ERROR)
            }
        });
    });

    socket.on(Command.CHANGE_PASSWORD, function(data, callback){
        var oldPassword = data.oldPassword;
        var newPassword = data.newPassword;
        log(Command.CHANGE_PASSWORD)
        db.checkPassword(socket.user.id, oldPassword, function(correct){
            if(correct){
                db.changePassword(socket.user.id, newPassword, function(succ){
                    if(succ){
                        callback(SUCCESS)
                    }else{
                        callback(ERROR)
                    }
                });
            }else{
                callback({succ: false, err: "Incorrect Password"})
            }
        });
    });

    socket.on(Command.CHANGE_EMAIL, function(data, callback){
        var password = data.password;
        var email = data.email;
        log(Command.CHANGE_EMAIL + ": " + email)
        db.checkPassword(socket.user.id, password, function(correct){
            if(correct){
                if(validate.validateEmail(email)){
                    db.changeEmail(socket.user.id, email, function(succ){
                        if(succ){
                            callback({succ: true, email: email})
                            socket.user.email = email;
                        }else{
                            callback(ERROR)
                        }
                    });
                }else{
                    callback({succ: false, err: "Invalid email address"})
                }
            }else{
                callback({succ: false, err: "Incorrect password"})
            }
        });
    });
    socket.on(Command.GET_FAVORITE_LIST, function(callback){
        log(Command.GET_FAVORITE_LIST)
        db.getFavoriteList(socket.user.id, function(data){
            callback(data)
        });
    });
    socket.on(Command.FAVORITE_HOUSE, function(data, callback){
        var houseId = data.id;
        var favorite = data.favorite;
        log(Command.FAVORITE_HOUSE + " " + favorite + " id: " + houseId);
        if(favorite){
            db.favoriteHouse(socket.user.id, houseId, function(data){
                callback(data);
                socket.join(HOUSE + houseId)
            });
        }else{
            db.unFavoriteHouse(socket.user.id, houseId, function(data){
                callback(data);
            });
        }
    });
    socket.on(Command.GET_PROFILE, function(userId, callback){
        log(Command.GET_PROFILE + " id: " + userId)
        db.getProfile(userId, socket.user.id, function(data){
            callback(data);
        });
    });
    socket.on(Command.GET_HOUSE, function(houseId, callback){
        log(Command.GET_HOUSE + " id: " + houseId)
        db.getHouse(socket.user.id, houseId, function(data){
            callback(data);
        });
    });
    socket.on(Command.GET_OLD_MESSAGES, function(data, callback){
        var houseId = data.id;
        var oldestMessageId = data.oldestMessageId;
        log(Command.GET_OLD_MESSAGES + " h_id: " + houseId + " m_id: " + oldestMessageId)
        db.isBlocked(houseId, socket.user.id, function(blocked){
            if(!blocked){
                db.getOldMessages(houseId, oldestMessageId, function(data){
                    callback(data);
                });
            }else{
                callback(ERROR);
            }
        });
    });
    socket.on(Command.GET_NEW_MESSAGES, function(data, callback){
        var houseId = data.id;
        var newestMessageId = data.newestMessageId;
        log(Command.GET_NEW_MESSAGES + " h_id: " + houseId + " m_id: " + newestMessageId)
        db.getNewMessages(houseId, newestMessageId, function(data){
            callback(data);
        });
    });
    socket.on(Command.GET_BLOCK_LIST, function(callback){
        log(Command.GET_BLOCK_LIST)
        db.getBlockList(socket.user.id, function(data){
            callback(data);
        });
    });
    socket.on(Command.SEND_MESSAGE, function(data, callback){
        var houseId = data.id;
        var localId = data.localId;
        var message = data.message;
        var time = (new Date).getTime() / 1000;
        log(Command.SEND_MESSAGE + " id: " + houseId + " m: " + message)
        db.isBlocked(houseId, socket.user.id, function(blocked){
            if(!blocked){
                db.newMessage(socket.user.id, houseId, message, function(data){
                    var houseName = data.house_name;
                    if(houseName != null){
                        data.localId = localId;
                        data.house_id = houseId;
                        data.name = socket.user.name;
                        data.username = socket.user.username;
                        data.time = time;
                        data.user_id = socket.user.id;
                        data.message = message;
                        data.status = 1;
                        data.p_status = 1;
                        data.succ = true;
                        socket.emit(Command.SEND_MESSAGE, data, function(){
                            socket.broadcast.to(HOUSE + houseId).emit(Command.NEW_MESSAGE, data);
                        });
                    }else{
                        //???
                    }
                });
            }else{
                callback({succ: false, err: "You are blocked from this house"});
            }
        });
    });
    socket.on(Command.BLOCK_USER, function(data, callback){
        var blockId = data.id
        var block = data.block;
        log(Command.BLOCK_USER + " " + block + " id: " + blockId)
        if(block){
            db.blockUser(socket.user.id, blockId, function(err, user){
                if(err){
                    callback(ERROR)
                }else{
					user.succ = true;
					user.block = true;
					callback(user);
					io.to(USER + blockId).emit(Command.BLOCKED_BY_USER, {id: socket.user.id, block: true});
				}
            });
        }else{
            db.unblockUser(socket.user.id, blockId, function(err){
                if(err){
                    callback(ERROR)
                }else{
					callback({succ: true, id: blockId, block: block});
					io.to(USER + blockId).emit(Command.BLOCKED_BY_USER, {id: socket.user.id, block: false});
				}
            });
        }
    });
    socket.on(Command.GET_AVATAR, function(id, callback){
        log(Command.GET_AVATAR + " id: " + id)
        fs.readFile('avatars/' + id + "avatar.jpg", function(err, buf){
			db.getAvatarTime(id, function(time){
				callback({id: id, image: true, byteArray: buf, time: time});
			});
        });
    });
	socket.on(Command.UPDATE_AVATARS, function(data){
		log(Command.UPDATE_AVATARS + " #: " + data.length);
		for(var i = 0; i < data.length; i++){
			var id = data[i].id;
			var time = data[i].time;
			db.getAvatarTime(id, function(avatarTime){
				if(time < avatarTime){
					fs.readFile('avatars/' + id + "avatar.jpg", function(err, buf){
						socket.emit(Command.GET_AVATAR, {id: id, image: true, byteArray: buf, time: avatarTime});
					});
				}
			});
		}
	});
    socket.on(Command.GET_MESSAGE_STATUS, function(id, callback){
        log(Command.GET_MESSAGE_STATUS + " id: " + id)
        db.getMessageStatus(id, function(data){
            callback(data);
        });
    });
    socket.on(Command.SEND_AVATAR, function(buf, callback){
        log(Command.SEND_AVATAR)
        gm(buf).quality(70).write('avatars/' + socket.user.id + "avatar.jpg", function(err){
            if(err){ console.log(err) }
        });
		var time = (new Date).getTime() / 1000;
		db.setAvatarTime(socket.user.id, time);
    });
    socket.on(Command.JOIN_HOUSE, function(houseId, callback){
        log(Command.JOIN_HOUSE + " id: " + houseId)
        db.isBlocked(houseId, socket.user.id, function(blocked){
            if(!blocked){
                socket.join(HOUSE + houseId);
                callback(SUCCESS)
            }else{
                callback({succ: false, err: "You are blocked from this house"});
            }
        });
    });
    socket.on(Command.READ_HOUSE, function(houseId){
        log(Command.READ_HOUSE + " id: " + houseId)
        db.readHouse(socket.user.id, houseId)
    });
    socket.on(Command.LEAVE_HOUSE, function(id, callback){
        log(Command.LEAVE_HOUSE + " id: " + id)
        socket.leave(HOUSE + id);
    });
    socket.on(Command.READ_MESSAGE, function(id){
        log(Command.READ_MESSAGE+ " id: " + id)
        db.readMessage(id, socket.user.id, function(houseId){
            io.sockets.in(HOUSE + houseId).emit(Command.READ_MESSAGE, id);
        });
    });
    socket.on(Command.DELIVERED_MESSAGE, function(id){
        log(Command.DELIVERED_MESSAGE + " id: " + id)
        db.deliveredMessage(id, socket.user.id, function(houseId){
            io.sockets.in(HOUSE + houseId).emit(Command.DELIVERED_MESSAGE, id);
        });
    });
    socket.on(Command.SEARCH, function(string, callback){
        log(Command.SEARCH + ": " + string);
        db.search(socket.user.id, string, function(data){
            callback(data);
        })
    });
    socket.on(Command.GET_UNDELIVERED_MESSAGES, function(callback){
        log(Command.GET_UNDELIVERED_MESSAGES)
        db.getUndeliveredMessages(socket.user.id, function(data){
            callback(data);
        });
    });
    socket.on(Command.MUTE_HOUSE, function(data, callback){
        var mute = data.mute;
        var houseId = data.id;
        log(Command.MUTE_HOUSE + " id: " + houseId + " " + mute)
        if(mute){
            db.muteHouse(socket.user.id, houseId);
        }else{
            db.unMuteHouse(socket.user.id, houseId);
        }
    });
    socket.on(Command.LOGOUT, function(sessionId){
        db.removeSession(sessionId)
    });
}