// Main job is to check pads periodically for activity and notify owners when someone begins editing and when someone finishes.
var API = require('ep_etherpad-lite/node/db/API');
var async = require('ep_etherpad-lite/node_modules/async');
var settings = require('ep_etherpad-lite/node/utils/Settings');

var um = require('./UserManager');
 
// Settings -- EDIT THESE IN settings.json not here..
var pluginSettings = settings.ep_user_auth || {};
var checkFrequency = pluginSettings.checkFrequency || 60000; // 10 seconds
var staleTime =      pluginSettings.staleTime || 300000; // 5 minutes
var urlToPads =      (pluginSettings.url || "example.com") + "/p/";

// A timer object we maintain to control how we send emails
var timers = {};

exports.padUpdate = function (hook_name, context, cb) {
    var pad = context.pad;
    var padId = pad.id;
    sendUpdates(padId);

    // does an interval not exist for this pad?
    if(!timers[padId]){
        console.debug("Someone started editing "+padId);
        notify(padId, "startedEdit");
        console.debug("Create an interval time check for "+padId);
        timers[padId] = setInterval(function(){
            sendUpdates(padId);
        }, checkFrequency); 
    }else{ // an interval already exists so don't create

    }
};

var subjects = {
    startedEdit: "Someone started editing ",
    stoppedEdit: "Someone stopped editing "
}

function containsAuthor(userList, authorId) {
    for(var i=0;i<userList.length;i++) {
        if(userList[i].id == authorId)
            return true;
    }
    return false;
}

function notify(padId, type){
    um.getSubscribers(padId, function(recipients){ // get everyone we need to email
        if(recipients) {
            API.padUsers(padId, function(callback, data){ 
                console.debug("Current Pad Users:"+data.padUsers);
                async.forEach(recipients, function(recipient, cb){
                    um.getUser(recipient, function(user){
                        var send = typeof(user[type]) == "undefined" || user[type]; 
                        if(!containsAuthor(data.padUsers, user.author) && send) {
                            console.debug("Emailing "+recipient +" about a new update");
                            um.sendMail(user, {
                                text: "Your pad at "+urlToPads+padId +" is being edited, we're just emailing you let you know :)",
                                subject: subjects[type]+padId
                            });
                        }
                        else{
                            console.debug("Didn't send an email because user is already on the pad");
                        }
                    });
                    cb(); 
                },
                function(err){
                    // do some error handling..
                });
            });
        }
    });
}


sendUpdates = function(padId){
    // check to see if we can delete this interval
    API.getLastEdited(padId, function(callback, message){
        // we delete an interval if a pad hasn't been edited in X seconds.
        var currTS = new Date().getTime();
        if(currTS - message.lastEdited > staleTime) {
            console.debug("Interval went stale so deleting it from object and timer");
            notify(padId,"stoppedEdit");
            clearInterval(timers[padId]); // remove the interval timer
            delete timers[padId]; // remove the entry from the padId
        }
    });

}
