import cheerio = require('cheerio');
import request = require('request');
import moment = require('moment');

import GenreType = require('./types/GenreType');
import NonSpecificTimeType = require('./types/NonSpecificTimeType');
import IMovie = require('./types/IMovie');
import IMovieDetails = require('./types/IMovieDetails');
import MovieHelper = require('./movieHelper');
import SmsHelper = require('./smsHelper');

function buildSpeechletResponse(speechOutput: string, shouldEndSession = false,
    repromptText?: string, cardTitle?: string, cardContent?: string) {
    var response: any = {
        outputSpeech: {
            type: 'PlainText',
            text: speechOutput,
        },
        shouldEndSession
    };

    if (cardTitle && cardContent) {
        response.card = {
            type: 'Simple',
            title: cardTitle,
            content: cardContent
        }
    }
    if (repromptText) {
        response.reprompt = {
            outputSpeech: {
                type: 'PlainText',
                text: repromptText,
            }
        };
    }

    return response;
}

function buildResponse(sessionAttributes, speechletResponse) {
    var response = {
        version: '1.0',
        sessionAttributes,
        response: speechletResponse,
    };
    console.log('Here is response.', response);
    return response;
}


// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // If we wanted to initialize the session to have some attributes we could add those here.
    const sessionAttributes = {};
    const cardTitle = 'Welcome';
    const speechOutput = 'Welcome to Get Tickets. Get Tickets will help you find movies and get tickets. ' +
        'To get started, search for movies by saying, "What movies are playing?" or "What comedy movies are playing?"'
        + ' Once you find a movie you can get show times by saying "Get show times."';
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    const repromptText = 'You can search for movies by saying, what comedy movies are playing.';
    const shouldEndSession = false;

    callback(sessionAttributes,
        buildSpeechletResponse(speechOutput, shouldEndSession, repromptText, cardTitle, speechOutput));
}

function handleSessionEndRequest(callback) {
    const speechOutput = 'Thank you for trying Get Tickets. Have a nice day!';
    // Setting this to true ends the session and exits the skill.
    const shouldEndSession = true;

    callback({}, buildSpeechletResponse(speechOutput, shouldEndSession));
}

/**
 * Sets the color in the session and prepares the speech to reply to the user.
 */
function findMovies(intent, session, callback) {
    const genreSlot = intent.slots.Genre,
        citySlot = intent.slots.City;

    var genre = genreSlot.value,
        city = citySlot.value;

    let repromptText = '';
    let sessionAttributes: any = {};
    const shouldEndSession = false;
    let speechOutput = '';

    MovieHelper.getMovies(genre, city).then((movies: IMovie[]) => {
        if (movies.length === 0) {
            speechOutput = `I'm sorry. I was unable to find any ${genre || ''} movies for you.`;
        } else {
            sessionAttributes.movies = movies;
            sessionAttributes.selectedMovieIndex = 0;
            sessionAttributes.city = city;
            speechOutput = `Here are the top ${movies.length} ${genre || ''} movies. The first movie is ${movies[0].name}.  
                If you would like to hear the next movie, say next.`;
            repromptText += 'If you would like to hear the next movie, say next. If you would like to hear more details about this movie say get details. ';
            repromptText += 'If you would like to find show times for this movie say find show times. What would you like to do?';
        }
        callback(sessionAttributes,
            buildSpeechletResponse(speechOutput, shouldEndSession, repromptText));
    });
}

function nextMovie(intent, session, callback) {
    var sessionAttributes = session.attributes;
    var speechOutput = '',
        reprompt = 'If you would like to hear the next movie, say next. If you would like to hear more details about this movie say get details. ';
    reprompt += 'If you would like to find show times for this movie say find show times. What would you like to do?';
    if (!sessionAttributes.movies || sessionAttributes.selectedMovieIndex === undefined) {
        return;
    } else {
        if (sessionAttributes.selectedMovieIndex === sessionAttributes.movies.length - 1) {
            // At the end of the list
            speechOutput = `You are at the end of the list.`;
        } else {
            sessionAttributes.selectedMovieIndex++;
            var movie: IMovie = sessionAttributes.movies[sessionAttributes.selectedMovieIndex];
            speechOutput = `The next movie is ${movie.name}.`;
        }

        callback(sessionAttributes,
            buildSpeechletResponse(speechOutput, false, reprompt))
    }
}

function previousMovie(intent, session, callback) {
    var sessionAttributes = session.attributes;
    var speechOutput = '',
        reprompt = 'If you would like to hear the next movie, say next. If you would like to hear more details about this movie say get details. ';
    reprompt += 'If you would like to find show times for this movie say find show times. What would you like to do?';
    if (!sessionAttributes.movies || sessionAttributes.selectedMovieIndex === undefined) {
        return;
    } else {
        if (sessionAttributes.selectedMovieIndex === 0) {
            // At the end of the list
            speechOutput = `You are at the start of the list.`;
        } else {
            sessionAttributes.selectedMovieIndex--;
            var movie: IMovie = sessionAttributes.movies[sessionAttributes.selectedMovieIndex];
            speechOutput = `The previous movie is ${movie.name}.`;
        }

        callback(sessionAttributes,
            buildSpeechletResponse(speechOutput, false, reprompt))
    }
}

function getDetails(intent, session, callback) {
    var sessionAttributes = session.attributes;
    if (!sessionAttributes.movies || sessionAttributes.selectedMovieIndex === undefined) {
        return;
    } else {
        var movie: IMovie = sessionAttributes.movies[sessionAttributes.selectedMovieIndex];
        MovieHelper.getMovieDetails(movie, '', '').then((details: IMovieDetails) => {
            var speechOutput = `Here are details about ${movie.name}. ${details.synopsis}`;
            callback(sessionAttributes, buildSpeechletResponse(speechOutput, false));
        });
    }
}

function findShowtimes(intent, session, callback) {
    var sessionAttributes = session.attributes;
    var dateSlot = intent.slots.Date,
        timeSlot = intent.slots.Time,
        citySlot = intent.slots.City;
    var date = dateSlot && dateSlot.value ? dateSlot.value : sessionAttributes.date ? sessionAttributes.date : '',
        time = timeSlot && timeSlot.value ? timeSlot.value : sessionAttributes.time ? sessionAttributes.time : '',
        city = citySlot && citySlot.value ? citySlot.value : sessionAttributes.city ? sessionAttributes.city : '',
        speechOutput = '',
        repromptText = '';

    time = adjustTime(time);
    sessionAttributes.date = date;
    sessionAttributes.city = city;
    sessionAttributes.time = time;
    if (!sessionAttributes.movies || sessionAttributes.selectedMovieIndex === undefined) {
        // errror 
        return;
    }
    var movie: IMovie = sessionAttributes.movies[sessionAttributes.selectedMovieIndex];

    if (!date) {
        speechOutput = `Getting show times for ${movie.name}. What date would you like to go see it?`;
        repromptText = 'Tell me what day you would like to go see the movie so I can book a ticket.';
        callback(sessionAttributes, buildSpeechletResponse(speechOutput, false, repromptText));
    } else if (!time) {
        speechOutput = `Okay show times for ${date}. What time would you like to see it?`;
        repromptText = 'Tell me the time you would like to go see the movie so I can book a ticket.';
        callback(sessionAttributes, buildSpeechletResponse(speechOutput, false, repromptText));
    } else if (!city) {
        speechOutput = `Okay show times for ${date} at ${time}. Where would you like to go see the movie?`;
        repromptText = 'Tell me the city you would like to go see the movie in and I will find theaters.';
        callback(sessionAttributes, buildSpeechletResponse(speechOutput, false, repromptText));
    } else {
        MovieHelper.getMovieDetails(movie, date, time).then(details => {
            var times = details.showTimesPerDate[details.dates[0]][0];
            speechOutput = `${movie.name} is playing at ${times.theater.name} in ${times.name} format `;
            speechOutput += `at ${times.showTimes[0].startTime}. Would you like me to buy the tickets?`;
            sessionAttributes.showTimes = times;
            callback(sessionAttributes, buildSpeechletResponse(speechOutput, false));
        });
    }
}

function yesIntent(intent, session, callback) {
    var sessionAttributes = session.attributes,
        times: any = sessionAttributes.showTimes;

    if (!times) {
        return; // err
    }

    var speechOutput = 'Okay sending the tickets to your phone. Thank you for using Get Tickets!',
		phoneNumber = ''; // PUT YOUR PHONE NUMBER HERE - in the future this phone number can be captured first time by Alexa then stored in DynamoDB for persistency

    SmsHelper.sendSMS(phoneNumber, 'Here are your tickets courtesy of GetTickets from Alexa - ' + times.showTimes[0].ticketUrl, () => {
        callback(sessionAttributes, buildSpeechletResponse(speechOutput, true));
    });
}

function adjustTime(time: string) {
    if (NonSpecificTimeType[time] !== undefined) {
        switch (NonSpecificTimeType[time]) {
            case NonSpecificTimeType.AF:
                return '13:00';
            case NonSpecificTimeType.EV:
                return '17:00';
            case NonSpecificTimeType.MO:
                return '09:00';
            case NonSpecificTimeType.NI:
                return '22:00';
            default:
                return '';
        }
    } else {
        return time;
    }
}


// --------------- Events -----------------------

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}, 
        intent=${intentRequest.intent.name}`);

    const intent = intentRequest.intent;
    const intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if (intentName === 'FindMovies') {
        findMovies(intent, session, callback);
    } else if (intentName === 'FindShowtimes') {
        findShowtimes(intent, session, callback);
    } else if (intentName === 'GetDetails') {
        getDetails(intent, session, callback);
    } else if (intentName === 'AMAZON.YesIntent') {
        yesIntent(intent, session, callback);
    } else if (intentName === 'AMAZON.NextIntent') {
        nextMovie(intent, session, callback);
    } else if (intentName === 'AMAZON.PreviousIntent') {
        previousMovie(intent, session, callback);
    } else if (intentName === 'AMAZON.HelpIntent') {
        getWelcomeResponse(callback);
    } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
        handleSessionEndRequest(callback);
    } else {
        throw new Error('Invalid intent ' + intentName);
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
    // Add cleanup logic here
}

export var handler = (event, context, callback) => {
    try {
        console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

        /**
         * Uncomment this if statement and populate with your skill's application ID to
         * prevent someone else from configuring a skill that sends requests to this function.
         */

        if (event.session.application.applicationId !== 'amzn1.ask.skill.a5f9195b-363e-4a34-bf80-940ac48ce41e') {
            callback('Invalid Application ID');
        }


        if (event.session.new) {
            onSessionStarted({ requestId: event.request.requestId }, event.session);
        }

        if (event.request.type === 'LaunchRequest') {
            onLaunch(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'IntentRequest') {
            onIntent(event.request,
                event.session,
                (sessionAttributes, speechletResponse) => {
                    callback(null, buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === 'SessionEndedRequest') {
            onSessionEnded(event.request, event.session);
            callback();
        }
    } catch (err) {
        callback(err);
    }
};

// MovieHelper.getMovies('Sci-Fi', 'Las Vegas')
//     .then(movies => {
//         console.log('got the following results:', movies);

//         if (movies.length > 0) {
//             return MovieHelper.getMovieDetails(movies[0]);
//         }
//     }).then(movieDetails => {
//         if (!movieDetails) {
//             return;
//         }

//         console.log('-------');
//         console.log('movie details =>', movieDetails);
//     });
