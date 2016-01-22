var parseReply = require('parse-reply');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

var BUCKET_NAME = 'prompt-writewith.us-replies';

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
      var parsedReply = parseReply(data.Body.toString());
			console.log("Parsed email\n" + parsedReply);
			context.succeed(parsedReply);
		}
	});
};
