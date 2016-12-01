import request = require('request');

import GenreType = require('./types/GenreType');
import MovieHelper = require('./movieHelper');
import SmsHelper = require('./smsHelper');

const ScopedGenre: string = ''; // 'Sci-Fi';
const ScopedCity: string | number = ''; // Las Vegas';
const ScopedDay: string = '2016-12-01';
const ScopedTimeOfDay: string = ''; // '20:00';

console.log(`QUERY: ${ScopedGenre || 'ANY GENRE'} movies ${ScopedCity ? 'in ' + ScopedCity : 'anywhere'} on ${ScopedDay || 'any day'} starting at ${ScopedTimeOfDay || 'any time'} `)
console.log('');



MovieHelper.getMovies(ScopedGenre, ScopedCity)
    .then(movies => {
        console.log(`==> GOT ${movies.length} POSSIBLE MOVIE(s) <==`);

        if (movies.length > 0) {
            let randomIndex = Math.round(Math.random() * (movies.length - 1));
            if (movies.length > 1) {
                console.log('(picking a random movie from this list)');
            }

            return MovieHelper.getMovieDetails(movies[randomIndex], ScopedDay, ScopedTimeOfDay);
        }
    }).then(movieDetails => {
        if (!movieDetails) {
            return;
        }

        // console.log('-------');
        // console.log('movie details:');
        console.log(`${movieDetails.movie.name} - ${movieDetails.movie.year} - ${movieDetails.duration} - ${movieDetails.movie.genre} - ${movieDetails.movie.rating}`);
        console.log(`IMDB: ${movieDetails.imdbRating} - RottenTomatoes: ${movieDetails.rottenTomatoesRating}`);
        console.log(`Synopsis:`);
        console.log(movieDetails.synopsis);
        console.log(`Showtimes:`);

        let sentSms = false;
        movieDetails.dates.forEach(d => {
            console.log(`  ${d}:`);
            let showTimeFormats = movieDetails.showTimesPerDate[d];
            showTimeFormats.forEach(showTimeFormat => {
                console.log(`    ${showTimeFormat.name} :: ${showTimeFormat.theater.name}`);
                console.log(`      ${showTimeFormat.showTimes.map(showTime => showTime.startTime).join('  ')}`);

                if (!sentSms) {
                    var phoneNumber = ''; // PUT YOUR PHONE NUMBER HERE - in the future this phone number can be captured first time by Alexa then stored in DynamoDB for persistency
                    SmsHelper.sendSMS(phoneNumber, 'Here are your tickets courtesy of GetTickets from Alexa - ' + showTimeFormat.showTimes[0].ticketUrl, (error, data) => {
                        if (!error) {
                            console.log('SMS sent!');
                        }
                    });

                    sentSms = true;
                }
            });
        });
    });
