var Promise = require('promise');
var querystring = require('querystring');
var http = require('http');
var MailParser = require("mailparser").MailParser;
var parseReply = require('parse-reply');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var BUCKET_NAME = 'prompt-writewith.us-replies';

createNewMessage = function(groupId, userEmail, promptId, body) {
  var postData = querystring.stringify({
    groupId: groupId,
    userEmail: userEmail,
    promptId: promptId,
    body: body
  });

  var options = {
    hostname: 'ec2-54-165-68-117.compute-1.amazonaws.com',
    port: 3001,
    path: '/api/messages/createFromEmail',
    method: 'POST',
    headers: {
      'Authorization': 'ox66ovrH4CJ3COXRCab4U3dpY6Wy2z1F6164XO3pZI5n48leV6nLnbqMWt6Nk8AH',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  console.log('\n', 'INITIATING REQUEST', '\n', options, '\n', postData);

  return new Promise(function(resolve, reject) {
    var req = http.request(options, function(res) {
      var body = '';
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function(chunk) {
        body += chunk;
      });
      res.on('end', function() {
        console.log('Successfully processed HTTPS response');
        // If we know it's JSON, parse it
        if (res.headers['content-type'] === 'application/json') {
          body = JSON.parse(body);
        }
        console.log(body);
        resolve(body);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

exports.handler = function(event, context) {
  var sesNotification = event.Records[0].ses;
  var key = 'Emails/' + sesNotification.mail.messageId;
  console.log('Retreiving key from bucket (' + key + ')');

  s3.getObject({
    Bucket: BUCKET_NAME,
    Key: key
  }, function(error, data) {
    if (error) {
      console.log(error, error.stack);
      context.fail(error);
    } else {
      console.log("Raw email:\n" + data.Body);
      console.log("===============================");
      var mailparser = new MailParser();
      mailparser.on("end", function(mail){
        var parsedReply = parseReply(mail.text).trim();
        var userEmail = mail.from[0].address;

        var promptEmail = mail.to[0].address;
        var prompt = promptEmail.split('@')[0].split('+');
        var groupName = prompt[0];
        var ids = prompt[1].match(/\d+/g);
        var promptId = ids[0];
        var groupId = ids[1];

        console.log("Group: " + groupName);
        console.log("Prompt id: " + promptId);
        console.log("Email From: " + userEmail);
        console.log("Parsed email\n" + parsedReply);

        createNewMessage(groupId, userEmail, promptId, parsedReply).then(function(response) {
          context.succeed(response);
        }).catch(function(error) {
          context.fail(error);
        });
      });

      mailparser.write(data.Body);
      mailparser.end();
    }
  });
};
