var mysql = require('mysql');
var bcrypt = require('bcryptjs');
var crypto = require('crypto');
var connection;

var ERROR = {succ: false, err: "An error has occurred"};

function createNewConnection(){
    connection = mysql.createConnection({
        host     : 'localhost',
        user     : 'root',
        password : '',
        database: 'machat2'
    });
    connection.connect(function(err){
        if(err){
            console.log('error connecting: ', err);
            connection.end();
            setTimeout(createNewConnection(), 2000);
        }else{
            console.log('connected as id ' + connection.threadId);
        }
    });
    connection.on('error', function(err){
        console.log('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET'){
            connection.end();
            createNewConnection();
        }else{
            throw err;
        }
    });
}

createNewConnection();

function generate_session(){
    var sha = crypto.createHash('sha256');
    sha.update(Math.random().toString());
    return sha.digest('hex');
};

exports.register = function(username, email, password, callback){
    var row = {username: username, name: username, email: email}

    connection.query('SELECT id FROM users WHERE username = ?', [username], function(err, rows){
        if(err){
            console.log(err)
            callback(ERROR)
        }else if(rows.length != 0){
            callback({succ: false, err: "Username is already taken"})
        }else{
            bcrypt.genSalt(10, function(err, salt) {
                if(err){
                    callback(ERROR)
                    console.log(err)
                }else{
                    bcrypt.hash(password, salt, function(err, hash) {
                        if(err){
                            callback(ERROR)
                        }else{
                            row.password = hash;
                            row.salt = salt;
                            connection.query('INSERT INTO users SET ?', row, function(err, result){
                                if(err){
                                    console.log(err);
                                    callback(ERROR);
                                }else{
                                    connection.query('SELECT LAST_INSERT_ID() AS id', function(err, rows){
                                        if(err){
                                            console.log(err)
                                        }else if(rows.length == 0){
                                            console.log("Select Last_Insert_Id failed? - Register User")
                                        }else{
                                            var id = rows[0].id;
                                            var data = {user_id: id, house_id: id}
                                            connection.query('INSERT INTO favorites SET ?', data, function(err, result){
                                                if(err){
                                                    console.log(err)
                                                }
                                            });
											var machatHouse = {user_id: id, house_id: 68}
											connection.query('INSERT INTO favorites SET ?', machatHouse, function(err, result){
												if(err){
													console.log(err)
												}
											});
                                        }
                                    });
                                    callback({succ: true, err: ""});
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}

exports.login = function(username, password, callback){
    connection.query('SELECT salt FROM users WHERE username = ?', username, function(err, rows){
        if(err){
            console.log(err);
            callback(ERROR)
        }else if(rows.length == 0){
            callback({succ: false, err: "Wrong username or password"})
        }else{
            var row = rows[0];
            var salt = row.salt
            bcrypt.hash(password, salt, function(err, hash){
                connection.query('SELECT u.id, u.username, u.name, u.email, IFNULL(m.id, 0) AS m_id, IFNULL(m.message,"") AS message, IFNULL(UNIX_TIMESTAMP(m.time),0) AS time, IFNULL(m.status,3) AS status, IFNULL(u2.id, 0) AS m_user_id, IFNULL(u2.username,"") AS m_username, IFNULL(u2.name,"") AS m_name, IFNULL(f.mute, false) AS mute FROM users u LEFT JOIN messages m ON m.id = (SELECT MAX(m2.id) FROM messages m2 WHERE m2.house_id = u.id) LEFT JOIN users u2 ON m.user_id = u2.id LEFT JOIN favorites f ON u.id = f.user_id && u.id = f.house_id WHERE u.username = ? && u.password = ?', [username, hash], function(err, rows){
                    if(err){
                        console.log(err)
                        callback(ERROR)
                    }else if(rows.length == 0){
                        callback({succ: false, err: "Wrong username or password"})
                    }else{
                        var data = rows[0];
                        var session_id = generate_session();
                        data.succ = true;
                        data.session_id = session_id;
                        var session = {session_id: session_id, user_id: data.id}
                        connection.query('INSERT INTO sessions SET ?', session, function(err){
                            if(err){
                                console.log(err)
                            }else{
                                callback(data)
                            }
                        });
                    }
                });
            });
        }
    });
}

exports.removeSession = function(sessionId){
    connection.query('DELETE FROM sessions WHERE session_id = ?', [sessionId], function(err, result){
        if(err){
            console.log(err)
        }
    });
}

exports.getAvatarTime = function(userId, callback){
	connection.query('SELECT UNIX_TIMESTAMP(avatarTime) AS time FROM users WHERE id = ?', userId, function(err, rows){
		if(err){
			console.log(err);
		}else if(rows.length == 0){
			console.log("Get_Avatar_Time user doesn't exist");
		}else{
			callback(rows[0].time);
		}
	});
}

exports.setAvatarTime = function(userId, time){
	connection.query('UPDATE users SET avatarTime = now() WHERE id = ?', [userId], function(err, result){
		if(err){
			console.log(err)
		}
	});
}

exports.getProfile = function(userId, myId, callback){
    connection.query('SELECT u.id, u.username, u.name, IFNULL(b.block_id, 0) AS block_id FROM users u LEFT JOIN block b ON b.block_id = u.id && b.user_id = ? WHERE u.id = ?', [myId, userId], function(err, rows){
        if(err){
            console.log(err)
        }else if(rows.length == 0){
            console.log("GET_PROFILE error, no rows");
        }else{
            callback(rows[0]);
        }
    });
}

exports.blockUser = function(userId, blockId, callback){
    var data = {user_id: userId, block_id: blockId};
    connection.query('INSERT INTO block SET ?', data, function(err, result){
        if(err){
			callback(true)
            console.log(err);
        }else{
			connection.query('SELECT u.id, u.name, u.username FROM block AS b INNER JOIN users u ON u.id = b.block_id WHERE b.user_id = ? && b.block_id = ?', [userId, blockId], function(err, rows){
				if(err){
					console.log(err)
					callback(true)
				}else if(rows.length == 0){
					console.log("Block User no user selected")
					callback(true)
				}else{
					callback(false, rows[0])
				}
			});
        }
    });
}

exports.unblockUser = function(userId, blockId, callback){
    connection.query('DELETE FROM block WHERE user_id = ? && block_id = ?', [userId, blockId], function(err, result){
        if(err){
            console.log(err);
            callback(true)
        }else{
            callback(false)
        }
    });
}

exports.getShortFavoriteList = function(userId, callback){
    connection.query('SELECT house_id FROM favorites WHERE user_id = ?', userId, function(err, rows){
        if(err){
            console.log(err)
        }else{
            callback(rows);
        }
    });
}

exports.loginSession = function(sessionId, callback){
    connection.query('SELECT u.id, u.username, u.name, u.email, IFNULL(m.id, 0) AS m_id, IFNULL(m.message,"") AS message, IFNULL(UNIX_TIMESTAMP(m.time),0) AS time, IFNULL(m.status,3) AS status, IFNULL(u2.id, 0) AS m_user_id, IFNULL(u2.username,"") AS m_username, IFNULL(u2.name,"") AS m_name, IFNULL(f.mute, false) AS mute FROM sessions s INNER JOIN users u ON u.id = s.user_id LEFT JOIN messages m ON m.id = (SELECT MAX(m2.id) FROM messages m2 WHERE m2.house_id = u.id) LEFT JOIN users u2 ON m.user_id = u2.id LEFT JOIN favorites f ON u.id = f.user_id && u.id = f.house_id WHERE s.session_id = ?', [sessionId], function(err, rows){
        if(err){
            console.log(err);
            callback(ERROR)
        }else if(rows.length == 0){
            callback({succ: false, err: "Session ID doesn't exist"})
        }else{
            var row = rows[0];
            row.succ = true;
            row.session_id = sessionId;
            callback(row);
        }
    });
}

exports.getFavoriteList = function(userId, callback){
    connection.query('SELECT IFNULL(b.id, 0) AS block, u.id, u.username, u.name, f.mute, f.seen, IFNULL(m.id, 0) AS m_id, IFNULL(m.message, "") AS message, IFNULL(UNIX_TIMESTAMP(m.time), 0) AS time, IFNULL(m.status, 3) AS status, IFNULL(u2.id, 0) AS m_user_id, IFNULL(u2.username,"") AS m_username, IFNULL(u2.name,"") AS m_name FROM favorites f INNER JOIN users u ON u.id = f.house_id LEFT JOIN messages m ON m.id = (SELECT MAX(m2.id) FROM messages m2 WHERE m2.house_id = u.id) LEFT JOIN users u2 ON m.user_id = u2.id LEFT JOIN block b ON b.block_id = f.user_id && b.user_id = u.id WHERE f.user_id = ?', [userId], function(err, rows){
        if(err){
            console.log(err);
            callback(ERROR);
        }else if(rows.length == 0){
            callback({succ: false, err: "No favorites"})
            console.log("No favorites");
        }else{
            var data = {succ: true, favoriteList: rows}
            callback(data);
        }
    });
}

exports.getBlockList = function(userId, callback){
    connection.query('SELECT u.id, u.username, u.name FROM block b INNER JOIN users u ON b.block_id = u.id WHERE b.user_id = ?', [userId], function(err, rows){
        if(err){
            console.log(err);
            callback(ERROR)
        }else{
            callback(rows);
        }
    });
}

exports.muteHouse = function(userId, houseId, callback){
    connection.query('UPDATE favorites SET mute = 1 WHERE user_id = ? && house_id = ?', [userId, houseId], function(err, result){
        if(err){
            console.log(err)
        }
    });
}

exports.unMuteHouse = function(userId, houseId, callback){
    connection.query('UPDATE favorites SET mute = 0 WHERE user_id = ? && house_id = ?', [userId, houseId], function(err, result){
        if(err){
            console.log(err)
        }
    });
}

exports.favoriteHouse = function(userId, houseId, callback){
    var row = {user_id: userId, house_id: houseId}
    connection.query('INSERT INTO favorites SET ?', row, function(err, result){
        connection.query('SELECT IFNULL(b.id, 0) AS block, u.id, u.username, u.name, f.mute, f.seen, IFNULL(m.id, 0) AS m_id, IFNULL(m.message, "") AS message, IFNULL(UNIX_TIMESTAMP(m.time), 0) AS time, IFNULL(m.status, 3) AS status, IFNULL(u2.id, 0) AS m_user_id, IFNULL(u2.username,"") AS m_username, IFNULL(u2.name,"") AS m_name FROM favorites f INNER JOIN users u ON u.id = f.house_id LEFT JOIN messages m ON m.id = (SELECT MAX(m2.id) FROM messages m2 WHERE m2.house_id = u.id) LEFT JOIN users u2 ON m.user_id = u2.id LEFT JOIN block b ON b.block_id = f.user_id && b.user_id = f.house_id WHERE f.user_id = ? && f.house_id = ?', [userId, houseId], function(err, rows){
            if(err){
                console.log(err);
                callback(ERROR)
            }else if(rows.length == 0){
                callback({succ: false, err: "Favorite does not exist", favorite: true, id: houseId})
            }else{
                var row = rows[0];
                row.favorite = true;
                row.succ = true;
                callback(row);
            }
        });
    });
}

exports.unFavoriteHouse = function(userId, houseId, callback){
    if(userId != houseId){
        connection.query('DELETE FROM favorites WHERE user_id = ? && house_id = ?', [userId, houseId], function(err, result){
            if(err){
                console.log(err)
                callback(ERROR)
            }else{
                callback({succ: true, favorite: false, id: houseId})
            }
        });
    }else{
        callback(ERROR)
    }
};

exports.changeName = function(userId, name, callback){
    connection.query('UPDATE users SET name = ? WHERE id = ?', [name, userId], function(err, result){
        if(err){
            console.log(err);
            callback(false)
        }else{
            callback(true)
        }
    });
}

exports.changeEmail = function(userId, email, callback){
    connection.query('UPDATE users SET email = ? WHERE id = ?', [email, userId], function(err, result){
        if(err){
            console.log(err);
            callback(false);
        }else{
            callback(true);
        }
    });
}

exports.changePassword = function(userId, newPassword, callback){
    bcrypt.genSalt(10, function(err, salt) {
        if(err){
            console.log(err);
            callback(false)
        }else{
            bcrypt.hash(newPassword, salt, function(err, hash){
                if(err){
                    console.log(err)
                    callback(false)
                }else{
                    connection.query('UPDATE users SET salt = ?, password = ? WHERE id = ?', [salt, hash, userId], function(err, result){
                        if(err){
                            console.log(err)
                            callback(false)
                        }else{
                            callback(true)
                        }
                    });
                }
            });
        }
    });
}

exports.checkPassword = function(userId, password, callback){
    connection.query('SELECT salt FROM users WHERE id = ?', userId, function(err, rows){
        if(err){
            console.log(err)
            callback(false)
        }else if(rows.length == 0){
            console.log("UserId does not exist Change password");
            callback(false)
        }else{
            var salt = rows[0].salt
            bcrypt.hash(password, salt, function(err, hash) {
                connection.query('SELECT id FROM users WHERE id = ? && password = ?', [userId, hash], function(err, rows){
                    if(err){
                        console.log(err)
                        callback(false)
                    }else if(rows.length == 0){
                        callback(false)
                    }else{
                        callback(true)
                    }
                });
            });
        }
    });
}

exports.getOldMessages = function(houseId, messageId, callback){
    connection.query('SELECT m.id, m.house_id, m.user_id, m.message, m.status, u2.name AS house_name, UNIX_TIMESTAMP(m.time) AS time, u.username, u.name FROM messages m INNER JOIN users u ON u.id = m.user_id INNER JOIN users u2 ON u2.id = m.house_id WHERE house_id = ? && m.id < ? ORDER BY m.id DESC LIMIT 20', [houseId, messageId], function(err, rows){
        if(err){
            console.log(err);
            callback(ERROR);
        }else{
            var data = {succ: true, messageList: rows}
            callback(data)
        }
    });
}

exports.getNewMessages = function(houseId, messageId, callback){
    connection.query('SELECT m.id, m.house_id, m.user_id, m.message, m.status, u2.name AS house_name, UNIX_TIMESTAMP(m.time) AS time, u.username, u.name FROM messages m INNER JOIN users u ON u.id = m.user_id INNER JOIN users u2 ON u2.id = m.house_id WHERE house_id = ? && m.id > ? ORDER BY m.id DESC LIMIT 20', [houseId, messageId], function(err, rows){
        if(err){
            console.log(err);
            callback(ERROR)
        }else{
            var data = {succ: true, messageList: rows}
            callback(data);
        }
    });
}

exports.getHouse = function(userId, houseId, callback){
    connection.query('SELECT u.id, u.username, u.name, f.mute FROM users u LEFT JOIN favorites f ON f.house_id = u.id && f.user_id = ? WHERE u.id = ?', [userId, houseId], function(err, rows){
        if(err){
            console.log(err);
            callback(ERROR);
        }else if(rows.length == 0){
            callback({succ: false, err: "House does not exist"})
        }else{
            var row = rows[0];
            if(row.mute == null){ //Checks if house is a favorite of the user.
                row.favorite = false;
                row.mute = 0;
            }else{
                row.favorite = true;
            }
            callback(row);
        }
    });
}

exports.newMessage = function(userId, houseId, message, callback){
    var row = {user_id: userId, house_id: houseId, message: message}
    connection.query('INSERT INTO messages SET ?', row, function(err, result){
        if(err){
            console.log(err)
            callback(ERROR)
        }else{
            connection.query('SELECT LAST_INSERT_ID() AS id, name AS house_name FROM users WHERE id = ?', houseId, function(err, rows){
                if(err){
                    console.log(err)
                    callback(ERROR)
                }else if(rows.length == 0){
                    callback(ERROR)
                }else{
                    callback(rows[0])
                    var messageId = rows[0].id
                    connection.query('UPDATE favorites SET missed_messages = CASE mute WHEN 0 THEN missed_messages + 1 END, last_message = ?, seen = 0, delivered = 0 WHERE house_id = ? && user_id != ?', [messageId, houseId, userId], function(err, result){
                        if(err){
                            console.log(err);
                        }
                    });
                }
            });
        }
    });
}

exports.getMessageStatus = function(id, callback){
    connection.query('SELECT id, status FROM messages WHERE id = ?', [id], function(err, rows){
        if(err){
            console.log(err)
        }else if(rows.length == 0){
            console.log("Message does not exist - getMessageStatus")
        }else{
            callback(rows[0])
        }
    });
}

exports.readMessage = function(messageId, userId, callback){
    connection.query('UPDATE messages SET status = 3 WHERE id = ?', [messageId], function(err, result){
        if(err){
            console.log(err)
            callback(ERROR)
        }else{
            connection.query('SELECT house_id FROM messages WHERE id = ?', [messageId], function(err, rows){
                if(err){
                    console.log(err)
                }else if(rows.length == 0){
                    console.log("No house Id for read message")
                }else{
                    callback(rows[0].house_id);
                }
            });
        }
    });
}

exports.deliveredMessage = function(messageId, userId, callback){
    connection.query('UPDATE messages SET status = CASE status WHEN 1 THEN 2 ELSE status END WHERE id = ?', [messageId] ,function(err, result){
        if(err){
            console.log(err)
            callback(ERROR)
        }else{
            connection.query('SELECT house_id FROM messages WHERE id = ?', [messageId], function(err, rows){
                if(err){
                    console.log(err)
                }else if(rows.length == 0){
                    console.log("No house Id for read message")
                }else{
					var houseId = rows[0].house_id;
                    callback(houseId);
					connection.query('UPDATE favorites SET delivered = 1 WHERE user_id = ? && house_id = ?', [userId, houseId], function(err, result){
						if(err){
							console.log(err)
						}
					});
                }
            });
        }
    });
}

exports.getUndeliveredMessages = function(userId, callback){
    connection.query('SELECT f.house_id, u.name AS house_name, u2.name, m.message, f.missed_messages FROM favorites f INNER JOIN users u ON u.id = f.house_id INNER JOIN messages m ON f.last_message = m.id INNER JOIN users u2 ON u2.id = m.user_id WHERE f.user_id = ? && f.missed_messages != 0 && f.delivered = 0', [userId], function(err, rows){
        if(err){
            console.log(err)
        }else{
            callback(rows)
        }
        connection.query('UPDATE favorites SET delivered = 1 WHERE user_id = ?', userId, function(err, result){
            if(err){
                console.log(err)
            }
        });
    });
}

exports.readHouse = function(userId, houseId){
    connection.query('UPDATE favorites SET seen = 1, missed_messages = 0, delivered = 1 WHERE user_id = ? && house_id = ?', [userId, houseId], function(err, result){
        if(err){
            console.log(err)
        }
    });
}

exports.search = function(userId, string, callback){
    string += "%";
    connection.query('SELECT u.id, u.username, u.name, IFNULL(b.block_id,0) AS block FROM users u LEFT JOIN block b ON b.block_id = ? && b.user_id = u.id WHERE u.username LIKE ? OR u.name LIKE ?', [userId, string, string], function(err, rows){
        if(err){
            console.log(err)
            callback(ERROR)
        }else{
            callback(rows);
        }
    });
}

exports.isBlocked = function(userId, blockId, callback){
    connection.query('SELECT * FROM block WHERE user_id = ? && block_id = ?', [userId, blockId], function(err, rows){
        if(err){
            console.log(err)
        }else if(rows.length == 0){
            callback(false)
        }else{
            callback(true)
        }
    });
}