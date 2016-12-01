var aws = require('aws-sdk');
import Promise = require('bluebird');

const GetTicketsSubject = 'Get Tickets from Alexa';

class SmsHelper {
    private _sns: any;

    /**
     * CTOR
     */
    constructor() {
        this._sns = new aws.SNS({
            credentials: {
                accessKeyId: '', // PUT YOUR KEY HERE
                secretAccessKey: '', // PUT YOUR KEY HERE
            },
            region: '' // PUT YOUR REGION HERE
        });
    }

    /**
     * Send a given SMS to a given phone number
     */
    public sendSMS(phoneNumber: string, message: string, callback: Function) {
        var params: any = {
            Message: message,
            PhoneNumber: phoneNumber,
            Subject: GetTicketsSubject,
        };

        this._sns.publish(params, (err, data) => {
            if (err) {
                console.log('An error occured while sending SMS', err);
            } else {
                console.log('success sending SMS', data);
            }

            callback(err, data);
        });
    }
};

export = new SmsHelper;