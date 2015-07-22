var ERR = require("ep_etherpad-lite/node_modules/async-stacktrace");
var db = require('ep_etherpad-lite/node/db/DB').db;

var authorManager = require('ep_etherpad-lite/node/db/AuthorManager');

var crypto = require('crypto');
var email = require('emailjs');
var eMailAuth = require(__dirname + '/email.json');
var pkg = require('./package.json');

var DEBUG_ENABLED = false;

/*
 *  Common Utility Functions
 */
var log = function (type, message) {
    if (typeof message == 'string') {
        if (type == 'error') {
            console.error(pkg.name + ': ' + message);
        } else if (type == 'debug') {
            if (DEBUG_ENABLED) {
                console.log('(debug) ' + pkg.name + ': ' + message);
            }
        } else {
            console.log(pkg.name + ': ' + message);
        }
    }
    else console.log(message);
};

function encryptPassword(password) {
    return crypto.createHmac('sha256', "42").update(password).digest('hex');
};

function getRandomNum(lbound, ubound) {
    return (Math.floor(Math.random() * (ubound - lbound)) + lbound);
}

function getRandomChar(number, lower, upper, other, extra) {
    var numberChars = '0123456789';
    var lowerChars = 'abcdefghijklmnopqrstuvwxyz';
    var upperChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var otherChars = '`~!@#$%^&*()-_=+[{]}\\|;:\'",<.>/? ';
    var charSet = extra;
    if (number == true)
        charSet += numberChars;
    if (lower == true)
        charSet += lowerChars;
    if (upper == true)
        charSet += upperChars;
    if (other == true)
        charSet += otherChars;
    return charSet.charAt(getRandomNum(0, charSet.length));
}

function getRandomString(length) {
    var mylength = length || 40;
    var myextraChars = '';
    var myfirstNumber = true;
    var myfirstLower = true;
    var myfirstUpper = true;
    var myfirstOther = false;
    var mylatterNumber = true;
    var mylatterLower = true;
    var mylatterUpper = true;
    var mylatterOther = false;

    var rc = "";
    if (mylength > 0) {
        rc += getRandomChar(myfirstNumber, myfirstLower, myfirstUpper, myfirstOther, myextraChars);
    }
    for (var idx = 1; idx < mylength; ++idx) {
        rc += getRandomChar(mylatterNumber, mylatterLower, mylatterUpper, mylatterOther, myextraChars);
    }
    return rc;
}

function getKey(email) {
	return "users:"+email;
}

function userAuthenticated(req, cb) {
    log('debug', 'userAuthenticated');
    if (req.session.username && req.session.password && req.session.email) {
        cb(true);
    } else {
        cb(false);
    }
};

function userAuthentication(email, password, cb) {
    log('debug', 'userAuthentication');
    getUser(email, function (user) {
        if(user!=null)
			if (user.pswd == encryptPassword(password) && user.considered) {
				cb(true, user, false);
			} else {
				cb(false, user, user.considered);
			}
		else
			cb(false, null, false);
    });
};

function getUser(email, cb) {
    log('debug', 'getUser');
    db.get(getKey(email), function(err, user){
		cb(user); //null if error
	});
}

function updateUser(user) {
	db.set(getKey(user.email), user);
}

function changePw(email, oldPw, newPW, cb) {
	getUser(email, function(user) {
		if( user == null) {
			cb(false, 'user not found');
		} 
		else if(encryptPassword(oldPW) == user.pswd) {
			user.pswd = encryptPassword(newPW);
			updateUser(user);
			cb(true);
		} else {
			cb(false, 'Wrong Password');
		}
	});
}

function registerUser(user, cb) {
	var USER_EXISTS = 'User already Exists';
	var PASSWORD_WRONG = 'Passwords do not agree';

	var NO_VALID_MAIL = 'No valid E-Mail';
	var PW_EMPTY = 'Password is empty';
	
	if (user.password != user.passwordrepeat) {
		cb(false, PASSWORD_WRONG);
		return false; // break execution early
	}

	var Ergebnis = user.email.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,4}/);
	if (Ergebnis == null) {
		cb(false, NO_VALID_MAIL);
		return false; // break execution early
	}
	if (user.password == "") {
		cb(false, PW_EMPTY);
		return false; // break execution early
	}
	
	var retValue = getUser(user.email, function (exists) {
		if (exists!=null) {
			cb(false, USER_EXISTS);
		} else {
			var consString = getRandomString();
			var userWrite = {
				email: user.email,
				fullname: user.fullname,
				pswd: encryptPassword(user.password),
				considered: false
			};
			
			authorManager.createAuthorIfNotExistsFor(user.email, user.fullname, function (err, author) {
				if (err) {
					log('error', 'something went wrong while creating author');
					cb(false, "Error");
				} else {
					userWrite.author = author.authorID;
					updateUser(userWrite);
					db.set("confirm2user:"+consString, user.email);
					var msg = eMailAuth.registrationtext;
					msg = msg.replace(/<url>/, user.location + "confirm/" + consString);
					sendMail(userWrite, {
						text: msg,
						subject: eMailAuth.registrationsubject
					});
					cb(true);
				}
			});
		}
		return exists;
	});
	return retValue; // return status of function call
};

function deleteUser(email) {
	db.remove(getKey(email));
}

function getUserForConfirmCode(consString, cb) {
	db.get("confirm2user:"+consString, function(err,email) {
		if(email==null)
			cb(null);
		else 
			getUser(email, cb);
	});
}

function setToken(user, token) {
    // TODO clean up anonymous authors
	db.set("token2author:"+token, user.author);
	if(user.token && user.token!=token) { // delete old DB entry
		db.remove("token2author:"+user.token);
	}
	if(!user.token || user.token!=token) {
		user.token = token;
		updateUser(user);
	}
}

function addSubscription(email, padId) {
    db.get("subscribers:"+padId, function(err, subscribers){
        if(!subscribers) 
            subscribers = {};
        subscribers[email] = true;
        db.set("subscribers:"+padId, subscribers);
    });
}

function removeSubscription(email, padId) {
    db.get("subscribers:"+padId, function(err, subscribers){
        if(subscribers) {
            delete subscribers[email];
            db.set("subscribers:"+padId, subscribers);
        }
    });
}

function hasSubscribed(email, padId, cb) {
    db.get("subscribers:"+padId, function(err, subscribers){
        if(!subscribers) 
            cb(false)
        else
            cb(subscribers[email]);
    });
}

function getSubscribers(padId, cb) {
    db.get("subscribers:"+padId, function(err, subscribers){
        if(subscribers)
            cb(Object.keys(subscribers))
        else {
            cb([]);
            console.error(err);
        }
    });
}



var emailserver = email.server.connect({
	user: eMailAuth.user,
	password: eMailAuth.password,
	host: eMailAuth.host,
	port: eMailAuth.port,
	ssl: eMailAuth.ssl,
	tls: eMailAuth.tls
});

function sendMail(user, message) {
    message.from =  eMailAuth.from;
    message.to =  user.fullname + " <" + user.email + ">";

	if (eMailAuth.smtp == "false") {
	    var nodemailer = require('nodemailer');
	    var transport = nodemailer.createTransport("sendmail");
	    transport.sendMail(message);
    }
    else {
		emailserver.send(message, function (err) {
			if (err) {
				log('error', err);
			}
		});
	}
}

module.exports = {
    getRandomString: getRandomString,
    sendMail: sendMail,
    
    changePw: changePw,
	deleteUser: deleteUser,
	getUser: getUser,
	getUserFromConfirmCode: getUserForConfirmCode,
	registerUser: registerUser,
	setToken: setToken,
	updateUser: updateUser,
	userAuthenticated: userAuthenticated,
	userAuthentication: userAuthentication,
	
	addSubscription: addSubscription,
    getSubscribers: getSubscribers,
    hasSubscribed: hasSubscribed,
	removeSubscription: removeSubscription
};