var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var fs = require('fs');

server.listen(3001);

var user_id = 1;
var message_id = 0;

io.on('connection', function (socket) {

    var ip = socket.conn.remoteAddress

    console.log("New connection at " + ip);

    socket.user = {};

    socket.on("login", function(data, callback){
        console.log("Username: " + data.username + " Password: " + data.password);
        socket.user.id = user_id;
        setTimeout(function(){
            callback({succ: true, id: user_id, username: "Maxwell", name: "Max", mute: false, email: "poop@gmail.com", sessionId: "niggerCake",
                message: {id: 3, message: "oblgagob", username: "nigsrule32", name: "nigsrule", userId: 5, time: 9001, status: 3}});
        }, 0)
    });
    socket.on('getFavoriteList', function (callback) {
        console.log("getFavoriteList");
        var data = [];
        data.push({id: socket.user.id, username: "Maxwell", name: "Max", mute: false,
            message: {id: 3, message: "oblgagob", username: "nigsrule32", name: "nigsrule", userId: 5, time: 9001, status: 3}})
        for(var i = 0; i < 20; i++){
            data.push({id: i, username: "BobNig", name: "Bob" + i, mute: false,
                message: {id: 3, message: "oblgagob", username: "nigsrule32", name: "nigsrule", userId: 5, time: 9001, status: 3}});
            i++;
            data.push({id: i, username: "Nigga", name: "Nigga" + i, mute: false,
                message: {id: 3, message: "oblgagob", username: "nigsrule32", name: "nigsrule", userId: 5, time: 500, status: 3}});
        }
        setTimeout(function(){
            callback(data)
        }, 0);
    });

    socket.on('getNewMessages', function(data, callback){
        var id = data.id;
        var messageId = data.newestMessageId;

        console.log("id: " + id + " getNewMessages: " + messageId);
        var data = []
        for(var i = 0; i < 3; i++){
            data.push({status: 3, houseId: id, houseName: "Bill", userId: 1, id: 15, username: "Bill", name: "Bill", message: "What up niqqas?", time: "303"})
        }
        callback(data);
    });

    socket.on('logout', function(){
       console.log("Logout " + socket.user.id);
    });

    socket.on('register', function(data, callback){
        var username = data.username;
        var email = data.email;
        var password = data.password;
        console.log("Register: " + username + " " + email + " " + password);
        callback({succ: true, err: ""});
    });

    socket.on('getOldMessages', function(data, callback){
        var id = data.id;
        var messageId = data.oldestMessageId;
        var firstTime = data.firstTime;
        console.log("Id: " + id + " Oldest Message Id: " + messageId + " firstTime " + firstTime);
        var data = []
        for(var i = 0; i < 7; i++){
            data.push({status: 3, houseId: id, houseName: "Bill", userId: 1, id: 3, username: "SnoopDog", name: "SnoopDog", message: "niggas " + i, time: "303"});
            data.push({status: 3, houseId: id, houseName: "Bill", userId: 2, id: 4, username: "Maxwell", name: "Max", message: "ASDF 123 lll heil hitler", time: "303"});
            data.push({status: 3, houseId: id, houseName: "Bill", userId: 1, id: 7, username: "SnoopDog", name: "SnoopDog", message: i + " ASDF 123  heil hitler asdf asdf wutwut", time: "303"});
        }
        setTimeout( function(){
                callback(data);
        }, 0);
    });

    socket.on('sendMessage', function(data, callback){
        var id = data.id;
        var localId = data.localId;
        var message = data.message;
        console.log("id: " + id + " message: " + message);
        var n = (new Date).getTime();
        console.log(n);
        var newMessage = {status: 1, houseId: id, houseName: "Bill", userId: socket.user.id, id: message_id, username: "Maxwell", name: "Max", message: message, time: n}
        newMessage.localId = localId;
        sendMessage(newMessage)
    });

    function sendMessage(message){
        socket.emit('sendMessage', message, function(){
            socket.broadcast.emit('newMessage', message);
        });
        message_id++;
    }

    socket.on('deliveredMessage', function(id){
        console.log("DeliveredMessage" + id);
        io.emit('deliveredMessage', id);
    });

    socket.on('readMessage', function(id){
        console.log("ReadMessage", + id)
        io.emit('readMessage', id);
    });

    socket.on('getAvatar', function(id, callback){
        console.log('getAvatar: ' + id)
        fs.readFile('avatars/' + id + "avatar.png", function(err, buf){
            callback({id: id, image: true, byteArray: buf});
        });
    });

    socket.on('sendAvatar', function(buf, callback){
       fs.writeFile('avatars/' + socket.user.id + "avatar.png", buf, function(err){
           if(err) throw err;
           callback({succ: true, err: ""});
       });
    });

    socket.on('getProfile', function(id, callback){
        console.log("Profile ID: " + id);
        setTimeout(function(){
            callback({id: id, username: 'Nigga1234', name: 'Nigga', isBlocked: true})
        }, 0)
    });

    socket.on('blockUser', function(data, callback){
        var id = data.id;
        var block = data.block
        console.log("ID: " + id + " Block: " + block);
        setTimeout( function(){
        callback({id: id, block: block})
        }, 0)
    });

    socket.on('favoriteHouse', function(data, callback){
        var id = data.id
        var favorite = data.favorite;
        console.log("favoriteHouse, ID: " + id, " Favorite: " + favorite);
        //callback with favoriteItem if adding a house to favorites.
        setTimeout( function(){
            callback({id: id, favorite: favorite, id: id, username: "Bob123", name: "NEW FAVORITE", mute: false, isRead: true, last_message: "Nigger: WTF IS THIS", message_time: 5})
        }, 0)
    });

    socket.on('getHouse', function(id, callback){
        console.log("getHouse, ID: " + id)
        setTimeout( function(){
       callback({id: id, username: "Bob123", name: "Bob", isFavorite: true, isMute: true})
        }, 0)
    });

    socket.on('muteHouse', function(data, callback){
        var id = data.id;
        var mute = data.mute;
        console.log("muteHouse, ID: " + id + " Mute: " + mute);
        setTimeout(function(){
            callback({id: id, mute: mute})
        }, 0)
    });

    socket.on('changeName', function(name, callback){
        console.log("ChangeName: " + name)
        callback({name: name, succ: true, err: ""})
    });

    socket.on('search', function(string, callback){
        console.log("Search: "  + string);
        var data = []
        for(var i = 0; i < 10; i++){
            var user = {id: i, username: "Nig" + i, name: "Nigga" + i}
            data.push(user);
        }
        callback(data)
    });

    socket.on('changeEmail', function(email, callback){
        console.log("ChangeEmail: " + email)
        callback({email: email, succ: true, err: ""})
    });

    socket.on('changePassword', function(data, callback){
        var oldPassword = data.oldPassword;
        var newPassword = data.newPassword;
        console.log(newPassword);
        callback({succ: true, err: ""});
    });

    socket.on('loginSession', function(sessionId, callback){
        console.log("sessionId: " + sessionId + " User ID: " + user_id);
        socket.user.id = user_id;
        callback({succ: true, id: user_id, username: "Maxwell", name: "Max", mute: false, email: "poop@gmail.com", sessionId: "niggerCake",
        message: {id: 3, message: "oblgagob", username: "nigsrule32", name: "nigsrule", userId: 5, time: 9001, status: 3}});
    });
    user_id++;
});