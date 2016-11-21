var cool = require('cool-ascii-faces');
var express = require('express');
var chatbot = require('./routes/chatbot');
var app = express();
var apiai = require('apiai');
var mysql = require('mysql');
var controller = require('./db.js');

var bodyParser = require('body-parser');
var request = require('request');
var ai = apiai(process.env.apiai_api_key);

app.set('port', (process.env.PORT || 5000));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(__dirname + '/public'));

// views is directory for all template files
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.get('/', function(request, response) {
  response.render('pages/index');
});
app.get('/gongamigo', function(request, response) {
  response.render('pages/amigo');
});
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
app.get('/cool', function(request, response) {
  response.send(cool());
});

app.get('/times', function(request, response) {
    var result = ''
    var times = process.env.TIMES || 5
    for (i=0; i < times; i++)
      result += i + ' ';
  response.send(result);
});
app.use('/chat', chatbot);
//fb webhook
app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === process.env.facebook_api_key) {
      	//console.log("just validating my facebook hook");
      res.status(200).send(req.query['hub.challenge']);
    } else {
      res.send('Error, wrong validation token');    
    }
});
//api.ai webhook
app.post('/apiaiwebhook', function(req, res){
	//console.log(req.body);
	
	switch(req.body.result.action){
		
		case 'findLabPartner':
			var userParameters = req.body.result.contexts[0].parameters;
			var result = req.body.result;
			result.fulfillment.speech = "";
			controller.conn.getConnection(function(err, connection){
				if(err){
					console.log("couldnt get connection: "+err);
				}
				var msql = 'select * from students where id != '+req.body.result.contexts[0].parameters.userId+' ORDER BY RAND()';
				var que = connection.query(msql, function(err, rows){
					if(err){//
						console.log("Error: "+err);
					}else{
						if(rows.length > 0){
							result.fulfillment.speech = "you can partner with: "+rows[0].user_name;
							modDataSending(rows[0].id,  "I found you a partner be nice. The name: " + userParameters.userName);
						}else{
							result.fulfillment.speech = "Couldn't find anyone interested/free in labs";
						}
						
					}
					connection.release();
					res.json(result.fulfillment);
				});
				console.log(que.sql);
			});
			break;
		case 'klklk':
			break;
		case 'intramurals.signup':
			break;
		case 'lab.signup':
			var result = req.body.result;
			
			var signupData = {
				id: req.body.result.contexts[0].parameters.userId,
				user_name: req.body.result.contexts[0].parameters.userName, 
				gender: req.body.result.contexts[0].parameters.gender
			};
			console.log(signupData);
			controller.conn.getConnection(function(err, connection){
				if(err){
					console.log("couldnt get connection: "+err);
				}
				connection.query('insert into students SET ?', signupData, function(err, resinsert){
					if(err){//
						if(err.code === 'ER_DUP_ENTRY'){
							result.fulfillment.speech = "Don't try tricky things haha, I already added you. ;)";
						}else if(err){
							result.fulfillment.speech = "I couldn't add you, not sure why. Try again later :( I feel bad!";
						}
						
						console.log("Mysql error: " + err);
					}else{
						result.fulfillment.speech = "You were successfully added to the lab partners list";
					}
					//controller.conn.release();
					connection.release();
					res.json(result.fulfillment);
				});
				
			});
			
			
			break;
		default: 
			console.log("no action found");
	}
});
app.post('/webhook', function(req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
    	//console.log("a page just called me");
    	data.entry.forEach(function(fbPageEntry) {
    		var fbID = fbPageEntry.id;
    		//console.log("the page with id " + fbID);
    		fbPageEntry.messaging.forEach(function(fbMsgEvent){
    			if(fbMsgEvent.message){
    				//console.log(fbMsgEvent.sender.id);
    				var name = "";
    				var gender = "";
    				var call_to_ai;
    				getUserFirstName(fbMsgEvent.sender.id, function(userinfo){
    					//console.log(userinfo);
    					name = userinfo.first_name + " " + userinfo.last_name;
    					gender = userinfo.gender;
    					console.log(fbMsgEvent.message.text);
						var options = {
						    sessionId: "Enter a 36 character ID", 
						    contexts:[{
						    	name: "generics", 
						    	parameters: {
						    		userId: fbMsgEvent.sender.id,
						    		userName: name,
						    		gender: gender
						    	}
						    }]
						};
	    				//var call_to_ai = ai.textRequest(fbMsgEvent.message.text);
	    				var call_to_ai = ai.textRequest(fbMsgEvent.message.text, options);
	    				//console.log(call_to_ai);//debug problem 
	    				call_to_ai.on('response', function(rs){
	    					var messageData = rs.result.fulfillment.speech;
	    					modDataSending(fbMsgEvent.sender.id,  name+", "+messageData);
	    				});
	    				call_to_ai.on('error', function(err){
	    					console.log(err + " API AI dropped some shit");
	    				});
	    				call_to_ai.end();//drop the call to ai

    				});
    				
    			}
    			if(fbMsgEvent.delivery){
    				console.log("Successfully delivered another message ");
    			}
    		});
    	});
    	res.sendStatus(200);
    }
});
function getUserFirstName(id, callback) {
    var ret;
    request.get({
        uri: 'https://graph.facebook.com/v2.6/' + id,
        qs: {
            fields: 'first_name, last_name, locale, timezone, gender',
            access_token: process.env.facebook_api_key,
        }
    }, function (err, resp, profile) {
        callback(JSON.parse(profile));
    });
}
function modDataSending(userToID, messageToSend){
	var finalData = {
		recipient: {
			id: userToID
		}, 
		message: {
			text: messageToSend
		}
	}
	console.log("I am about to reply automatically to the message " + userToID+ " seent");
	replyMessages(finalData);
}
function replyMessages(messageToSend){
	request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: { access_token: process.env.facebook_api_key },
        method: 'POST',
        json: messageToSend

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            console.log("Successfully sent generic message with id %s to recipient %s", 
            messageId, recipientId);
        } else {

            console.error("Unable to send message.");
            //console.error(response);
            console.error(error);
        }
    });
}