var eejs = require('ep_etherpad-lite/node/eejs');
var padManager = require('ep_etherpad-lite/node/db/PadManager');
var readonlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager');
var db = require('ep_etherpad-lite/node/db/DB').db;
var url = require('url');

var settings = require('ep_etherpad-lite/node/utils/Settings');
var sessionManager = require('ep_etherpad-lite/node/db/SessionManager');

var formidable = require("formidable");
var pkg = require('./package.json');

var um = require("./UserManager");

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

function sendError(error, res) {
    var data = {};
    data.success = false;
    data.error = error;
    log('error', error);
    res.send(data);
}

function sendTemplate(res, template, renderArgs) {
	res.send(eejs.require("ep_user_auth/templates/"+template, renderArgs));
}

function sendMessage(res, msg) {
	sendTemplate(res, "msgtemplate.ejs", {msg : msg});
}

exports.expressCreateServer = function (hook_name, args, cb) {
	args.app.param('pad', function (req, res, next, padId) {
		if(padId.indexOf("r.") === 0)
			next();
		else {
			um.userAuthenticated(req, function(authenticated) {
				if(!authenticated) {
                    readonlyManager.getReadOnlyId(padId, function(err, padId) {
                        var query = url.parse(req.url).query;
                        if ( query ) padId += '?' + query;
                        res.redirect(padId);
                    });
                }
				else
					next();
			});
		}
	});
	
    args.app.get('/register.html', function (req, res) {
        sendTemplate(res, "register.ejs", {});
    });

    args.app.post('/login', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            if (!fields.email) {
                sendError('No valid E-mail Address given', res);
                return false;
            } else if (!fields.password) {
                sendError('No password given', res);
                return false;
            }

            var email = fields.email;
            var password = fields.password;

            var retVal = um.userAuthentication(email, password, function (success, user, considered) {
                if (success) {
                    req.session.email = email;
                    req.session.password = password;
                    req.session.username = user.fullname;
                    req.session.baseurl = fields.url;
                    var token;
                    if(req.cookies.token) {
                    	token = req.cookies.token;
                    } else if (user.token) {
                    	token = user.token;
                    	res.cookie("token",token);
                    }
                    else {
                    	token = "t."+um.getRandomString(20);
                    	res.cookie("token",token);
                    }
                    um.setToken(user, token);
                    var data = {};
                    data.success = true;
                    if(fields.readOnlyId) {
                    	readonlyManager.getPadId(fields.readOnlyId, function(err, padId){
                    		data.padId = padId;
                            res.send(data);
                    	});
                    } else if (fields.redirect) {
                    	res.redirect("../");
                    }
                    else {
                        res.send(data);
                    }
                    return true;
                } else {
					if (user==null || considered) {
                        sendError('User or password wrong!', res);
                    }
                    else if (user!=null && !considered) {
                        sendError('You have to confirm your registration!', res);
                    }
                    return false;
                }
            });
            return retVal;
        });
    });

    args.app.post('/register', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            var user = {};
            user.fullname = fields.fullname;
            user.email = fields.email;
            user.password = fields.password;
            user.passwordrepeat = fields.passwordrepeat;
            user.location = fields.location;
            um.registerUser(user, function (success, error) {
                if (!success) {
                    sendError(error, res);
                } else {
                    var data = {};
                    data.success = success;
                    data.error = error;
                    res.send(data);
                }
            });
        });
    });

    args.app.post('/logout', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
	        req.session.email = null;
	        req.session.password = null;
	        req.session.userId = null;
	        req.session.username = null;
	        res.clearCookie("token");
	        if (fields.redirect) {
	        	res.redirect("../");
	        } else {
	            res.send(true);
	        }
        });
    });

    args.app.get('/confirm/:consString', function (req, res) {
        um.getUserFromConfirmCode(req.params.consString, function (user) {
            if (user==null) {
                sendMessage(res, "User not found!");
            } else {
                if (user.considered) {
					sendMessage(res, 'User already confirmed!');
                } else {
					user.considered = true;
                    um.updateUser(user);
					sendMessage(res, 'Thanks for your registration!');
                }
            }
        });
    });

    args.app.post('/getUser', function (req, res) {
        um.userAuthenticated(req, function (authenticated) {
            if (authenticated) {
                um.getUser(req.session.email, function (user) {
                    var data = {};
                    data.success = true;
                    data.user = user;
                    res.send(data);
                });
            } else {
                res.send({success:false,serror:"You are not logged in!!"});
            }
        });
    });

    args.app.post('/changeUserName', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            um.userAuthenticated(req, function (authenticated) {
                if (authenticated) {
                    if (fields.newUserName == "") {
                        sendError('User Name empty', res);
                    }
                    else {
						um.getUser(req.session.email, function(user) {
							if(user!=null) {
								user.fullname = fields.newUserName;
								um.updateUser(user);
							}
							res.send({success:user!=null});
						});
					}
                } else {
                    res.send("You are not logged in!!");
                }
            });
        });
    });

    args.app.post('/changeUserPw', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            um.userAuthenticated(req, function (authenticated) {
                if (authenticated) {
                    if (fields.newPW == "" || fields.oldPW == "") {
                        sendError('Password empty', res);
                        return;
                    }
                    um.changePw(req.session.email, fields.oldPW, fields.newPW, function (success, err) {
						if(!success) {
							sendError(err, res);
						} else {
							res.send({success:true});
						}
                    });
                } else {
                    res.send("You are not logged in!!");
                }
            });
        });
    });
    /*
    args.app.post('/deleteUser', function (req, res) {
        um.userAuthenticated(req, function (authenticated) {
            if (authenticated) {
				um.deleteUser(req.session.email);
            } else {
                res.send("You are not logged in!!");
            }
        });
    });*/
    
    args.app.post('/setPassword', function (req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            um.userAuthenticated(req, function (authenticated) {
                if (authenticated) {
                    padManager.getPad(fields.padId, null, function (err, origPad) {
                        if (err) {
                            log('error', err);
                            res.send({success:false, error: err});
                            return false;
                        }
                        origPad.setPassword(fields.pswd);
                        res.send({success:true});
                        return true;
                    });
                } else {
                    res.send({success:false, error:"You are not logged in!!"});
                }
            });
        });
    });
    
    args.app.post("/subscribe", function(req, res) {
        new formidable.IncomingForm().parse(req, function (err, fields) {
            um.userAuthenticated(req, function (authenticated) {
                if (authenticated) {
                    if(fields.action == "set") {
                        um.addSubscription(req.session.email, fields.padId);
                        res.send({success:true});
                    }
                    else if(fields.action == "clear") {
                        um.removeSubscription(req.session.email, fields.padId);
                        res.send({success:true});
                    }
                    else if(fields.action == "status") {
                        um.hasSubscribed(req.session.email, fields.padId, function(subscribed){
                            res.send({success:true, status: subscribed});
                        });
                    }
                    else
                        res.send({success:false, error: "Unkown action"});
                } else {
                    res.send({success:false, error:"You are not logged in!!"});
                }
            });
        });
    });
    
    return cb();

};
exports.eejsBlock_indexWrapper = function (hook_name, args, cb) {
    args.content = args.content + eejs.require("ep_user_auth/templates/login.ejs");
	args.content = args.content + "<link href='./static/plugins/ep_user_auth/static/css/index.css' rel='stylesheet'>\n";
    return cb();
};

exports.eejsBlock_styles = function (hook_name, args, cb) {
	//args.content = args.content + "<link href='../static/plugins/ep_user_auth/static/css/styles.css' rel='stylesheet'>\n";
    args.content = args.content + '<link href="../static/plugins/ep_user_auth/static/css/notifications.css" rel="stylesheet">';
    return cb();
};

exports.eejsBlock_scripts = function (hook_name, args, cb) {
	//args.content = args.content + 
    //    "<script type=\"text/javascript\" src='../static/plugins/ep_user_auth/static/js/login.js'></script>\n";
    //args.content = args.content + 
    //    "<script type='text/javascript' src='../static/plugins/ep_user_auth/static/js/ep_email.js'></script>\n";
    return cb();
};

exports.eejsBlock_mySettings = function (hook_name, args, cb) {
    args.content = args.content + eejs.require('ep_user_auth/templates/padSettings.ejs');
    return cb();
};

exports.eejsBlock_userlist = function (hook_name, args, cb) {
	args.content = args.content + eejs.require("ep_user_auth/templates/login.ejs");
    return cb();
};
