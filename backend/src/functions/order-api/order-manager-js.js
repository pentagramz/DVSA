var serialize = require('node-serialize');
var AWS = require('aws-sdk');
var jose = require('node-jose');

exports.handler = async (event, context, callback) => {
    var req = serialize.unserialize(event.body);
    var headers = serialize.unserialize(event.headers);
    var auth_header = headers.Authorization || headers.authorization;
    var token_sections = auth_header.split('.');
    var auth_data = jose.util.base64url.decode(token_sections[1]);
    var token = JSON.parse(auth_data);
    var isAdmin = false;
    var user = token.username;

    var params = {
      UserPoolId: process.env.userpoolid,
      Username: user
    };
    try {
        const cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
        const userData = await cognitoidentityserviceprovider.adminGetUser(params).promise();
        var len = Object.keys(userData.UserAttributes).length;
        if (userData.UserAttributes[len-1].Name === "custom:is_admin" || userData.UserAttributes[len-1].Name === "dev:custom:is_admin") {
          isAdmin = userData.UserAttributes[len-1].Value;
        }
        var action = req.action;
        var isOk = true;
        var payload = {};
        var functionName = "";
        switch(action) {
            case "new":
                payload = { "user": user, "cartId": req["cart-id"], "items": req["items"] };
                functionName = "DVSA-ORDER-NEW";
                break;

            case "update":
                payload = { "user": user, "orderId": req["order-id"], "items": req["items"] };
                functionName = "DVSA-ORDER-UPDATE";
                break;

            case "cancel":
                payload = { "user": user, "orderId": req["order-id"] };
                functionName = "DVSA-ORDER-CANCEL";
                break;

            case "get":
                payload = { "user": user, "orderId": req["order-id"] };
                functionName = "DVSA-ORDER-GET";
                break;

            case "orders":
                payload = { "user": user };
                functionName = "DVSA-ORDER-ORDERS";
                break;

            case "account":
                payload = { "user": user };
                functionName = "DVSA-USER-ACCOUNT";
                break;

            case "profile":
                payload = { "user": user, "profile": req["data"]  };
                functionName = "DVSA-USER-PROFILE";
                break;

            case "shipping":
                payload = { "user": user, "orderId": req["order-id"], "shipping": req["data"] };
                functionName = "DVSA-ORDER-SHIPPING";
                break;

            case "billing":
                payload = { "user": user, "orderId": req["order-id"], "billing": req["data"] };
                functionName = "DVSA-ORDER-BILLING";
                break;

            case "inbox":
                payload = { "action": "inbox", "user": user };
                functionName = "DVSA-USER-INBOX";
                break;

            case "message":
                payload = { "action": "get", "user": user, "msgId": req["msg-id"], "type": req["type"] };
                functionName = "DVSA-USER-INBOX";
                break;

            case "delete":
                payload = { "action": "delete", "user": user, "msgId": req["msg-id"] };
                functionName = "DVSA-USER-INBOX";
                break;

            case "upload":
                payload = { "user": user, "file": req["attachment"] };
                functionName = "DVSA-FEEDBACK-UPLOADS";
                break;

            case "feedback":
                // currently we do NOTHING with the feedback. We promise to have better support in the future ;)
                //payload = { "user": user, "data": data };
                //functionName = "DVSA-FEEDBACK-UPLOADS";
                //break;
                 const response = {
                        statusCode: 200,
                        headers: {
                            "Access-Control-Allow-Origin" : "*"
                        },
                        body: JSON.stringify({"status": "ok", "message": "Thank you."})
                 };
                 callback(null, response);

            case "admin-update-order":
                if (isAdmin == false) {
                    const response = {
                        statusCode: 403,
                        headers: {
                            "Access-Control-Allow-Origin" : "*"
                        },
                        body: JSON.stringify({"status": "err", "message": "Unauthorized"})
                     };
                     callback(null, response);
                }
                else {
                    payload = { "user": user, "data": req["data"] };
                    functionName = "DVSA-ADMIN-UPDATE-ORDERS";
                    break;
                }

            default:
                isOk = false;
        }

        if (isOk == true) {

            var lambda = new AWS.Lambda();
            var params = {
              FunctionName: functionName,
              InvocationType: 'RequestResponse',
              Payload: JSON.stringify(payload)
            };

            lambda.invoke(params, function(err, data) {
                if (err) {
                    const response = {
                        statusCode: 200,
                        headers: {
                            "Access-Control-Allow-Origin" : "*"
                        },

                        body: JSON.stringify(JSON.parse(err.Payload))
                    };
                    callback(null, response);
                }
                else {
                    const response = {
                        statusCode: 200,
                        headers: {
                            "Access-Control-Allow-Origin" : "*"
                        },
                        body: JSON.stringify(JSON.parse(data.Payload))
                    };
                    callback(null, response);

                }
            });

        }
        else {
            var data = {"status": "err", "msg": "unknown action"};
            const response = {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin" : "*"
                },
                body: JSON.stringify(data),
            };
            callback(null, response);

        }
    }
    catch (e){
        console.log(e);
    }
};
