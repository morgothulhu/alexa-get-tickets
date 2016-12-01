import cheerio = require('cheerio');
import moment = require('moment');
import request = require('request');
import Promise = require("bluebird");

import GeoHelper = require('./geoHelper');
import GenreType = require('./types/GenreType');
import IMovie = require('./types/IMovie');
import IMovieDetails = require('./types/IMovieDetails');
import IMovieFormatShowtimes = require('./types/IMovieFormatShowtimes');
import IMovieShowtime = require('./types/IMovieShowtime');
import UrlHelper = require('./urlHelper');

const BaseUrl = 'https://www.bing.com';
const ExpectedResultTitlePrefix = 'Movies in ';
const MaxNumberShowtimesReturned = 3; // number of consecutive showtimes returned if time filter is given
const UserAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36';

class MovieHelper {
    /**
     * Fetch all movies for a given array of search fields
     * 
     * @param {string} [movieGenre] - The genre of the movie - mapped to the GenreType enum, if any.
     * @param {string} [city] - The city to be used as scope, if any.
     * @returns {Promise<Array<IMovie>>} - The matching results, if any.
     */
    public getMovies(movieGenre?: string, city?: string): Promise<Array<IMovie>> {
        // TODO - need to factor date/time
        var query = this._composeSearchQuery(movieGenre, city),
            requestPromise = Promise.promisify(request),
            url = `${BaseUrl}/search?q=${encodeURIComponent(query)}&qs=bs&form=QBRE`;

        return requestPromise({
            url,
            headers: {
                'User-Agent': UserAgent
            }
        }).then(response => {
            if (response.statusCode !== 200) {
                throw new Error(`Got invalid response ${response.statusCode}`);
            }

            let body = (<any>response).body,
                $ = cheerio.load(body),
                queryTitle = $('div.carousel div.carousel-title h2').text();
            if (queryTitle.substring(0, ExpectedResultTitlePrefix.length) !== ExpectedResultTitlePrefix) {
                throw new Error(`Unexpected query result ${queryTitle}`);
            }

            // console.log(`GOT RESULTS FOR '${queryTitle}'`);
            let moviesMatches = $('div.carousel div.carousel-scroll-content div.card a');
            let movies: Array<IMovie> = [];

            moviesMatches
                .each((index, element) => {
                    let movie: IMovie = null,
                        movieTitleAndYear = $(element).attr('title') || '',
                        movieTitleMatches = movieTitleAndYear.match(/^(.*) \(([0-9]{4})\)$/);
                    if (!movieTitleMatches || movieTitleMatches.length !== 3) {
                        console.warn('Unable to parse movie title - skipping');
                    } else {
                        let mpaaRatingAndGenre = $('div.subtit', element).text() || '',
                            mpaaRatingAndGenreMatches = mpaaRatingAndGenre.match(/^((.*) · )?(.*)$/);
                        if (!mpaaRatingAndGenreMatches || mpaaRatingAndGenreMatches.length !== 4) {
                            console.warn('Unable to parse movie subtitle - skipping');
                        } else {
                            let coverUrl = $('img', element).attr('src');

                            if (!coverUrl) {
                                // fallback
                                coverUrl = $('div[data-src]', element).attr('data-src');
                            }

                            movie = <IMovie>{
                                name: movieTitleMatches[1],
                                year: parseInt(movieTitleMatches[2]),
                                genre: GenreType[mpaaRatingAndGenreMatches[3]],
                                rating: mpaaRatingAndGenreMatches[2] || '',
                                detailsUrl: element.attribs['href'],
                                coverUrl
                            };
                        }
                    }

                    if (movie) {
                        movie.coverUrl = UrlHelper.enforceAbsoluteUrl(movie.coverUrl, BaseUrl);
                        movie.detailsUrl = UrlHelper.enforceAbsoluteUrl(movie.detailsUrl, BaseUrl);

                        movies.push(movie);
                    }
                });
            // console.log(`Found ${movies.length} match(es):`);

            // movies.forEach(m => { console.log(m); });
            // https://www.bing.com/search?q=moana+2016&filters=ufn%3a%22moana+2016%22+sid%3a%225fe4eb03-e69d-7cd4-9fcf-b9c83bc5b3ac%22+segment%3a%22generic.carousel%22+secq%3a%22comedy+movies+in+theater+in+seattle+tomorrow%22+supwlcar%3a%221%22+tsource%3a%22showtimes%22+latlong%3a%2247.6035690307617%2c-122.329452514648%22+location%3a%22Seattle%2c+WA%22+qasgsfilter%3a%22MWMzMWJkNGEtNzNmZi0wNGNlLTg5YzYtZWE2MjNlOTQ5OGRiQENvbWVkeQ%3d%3d%22+segmenttype%3a%22movie_showtimes%22+catesegtype%3a%22movie_showtimes%22+segtype%3a%22TW92aWU%3d%22+ctype%3a%220%22+mltype%3a%220%22+eltypedim1%3a%22Movie%22&FORM=SNAPCR
            return movies;
        }).catch(err => {
            console.error('Caught error.', err);
            return [];
        });
    }

    /**
     * Fetch the movie details for a given movie instance
     * 
     * @param {IMovie} movie - The movie to be scoped to.
     * @param {string} [date] - The day the showtimes are to be scoped to, if any. Expected format is yyyy-MM-dd.
     * @param {string} [time] - The time of day the showtimes are to be scoped to, if any. Expected format is HH:mm.
     * @returns {Promise<IMovieDetails>} - The movie details if found.
     */
    public getMovieDetails(movie: IMovie, date: string, time: string): Promise<IMovieDetails> {
        let requestPromise = Promise.promisify(request),
            that = this,
            $: CheerioStatic,
            showtimesPanel: Cheerio,
            sideDetailsPanel: Cheerio,
            dates: string[] = [];

        return requestPromise({
            url: movie.detailsUrl,
            headers: {
                'User-Agent': UserAgent
            }
        }).then(response => {
            if (response.statusCode !== 200) {
                throw new Error(`Got invalid response ${response.statusCode}`);
            }

            let body = (<any>response).body;

            $ = cheerio.load(body);

            let queryTitle = $('div.carousel div.carousel-title h2').text(),
                sideDetailsPanel = $('div#b_content ol#b_context'),
                showtimesPanel = $('div#b_content div.st_tab');
            if (queryTitle.substring(0, ExpectedResultTitlePrefix.length) !== ExpectedResultTitlePrefix) {
                throw new Error(`Unexpected query result ${queryTitle}`);
            } else if (!sideDetailsPanel) {
                throw new Error(`Unable to find side details panel`);
            } else if (!showtimesPanel) {
                throw new Error(`Unable to find showtimes panel`);
            } else {
                // console.log(`GOT DETAILED MOVIE RESULT FOR '${queryTitle}' >> ${movie.name}`);

                let promises: Promise<IMovieFormatShowtimes[]>[] = [],
                    dateToScopeTo: string = date ? moment(date, 'YYYY-MM-DD').toDate().toDateString() : '',
                    startTimeToScopeTo: string = time ? time.toUpperCase().trim() : '';
                $('div.tab-head div.tab-menu>ul>li', showtimesPanel).each((index, element) => {
                    let elem = $(element),
                        realDate = moment().add(index, 'day').toDate().toDateString(),
                        currentDate = elem.text();

                    if (!dateToScopeTo || dateToScopeTo === realDate) {
                        // console.log(`DATE = ${currentDate} as ${realDate} (scoped to ${dateToScopeTo})`);
                        let url = UrlHelper.enforceAbsoluteUrl(elem.attr('data-dataurl'), BaseUrl);

                        if (url) {
                            dates.push(realDate);
                            promises.push(that._getMovieTheaterAndTimes(currentDate, url, startTimeToScopeTo, MaxNumberShowtimesReturned));
                        }
                    }
                });

                return Promise.all(promises);
            }
        }).then((showtimes) => {
            let movieDetails: IMovieDetails = null;
            if (showtimes.length !== dates.length) {
                throw new Error('Unexpected error when mapping showtimes to dates');
            }

            let showTimesPerDate: any = {};
            dates.forEach((d, index) => {
                showTimesPerDate[d] = showtimes[index];
            })

            // get the fully expanded synopsis (if available), otherwise get the ellipsis-ed synopsis
            let synopsis = ($('div.b_snippet div.b_hide', sideDetailsPanel).text() || '').trim();
            if (!synopsis) {
                synopsis = ($('div.b_snippet', sideDetailsPanel).text() || '').trim();
            }

            // get the duration
            let movieYearDurationAndGenre = $('span.b_demoteText', sideDetailsPanel).text() || '',
                movieYearDurationAndGenreMatches = movieYearDurationAndGenre.match(/^ · ([0-9]{4}) · (.*) · (.*)$/),
                duration = '';
            if (!movieYearDurationAndGenreMatches || movieYearDurationAndGenreMatches.length !== 4) {
                console.warn('Unable to parse movie duration - ignoring');
            } else {
                duration = movieYearDurationAndGenreMatches[2];
            }

            // IMDB rating (e.g. 8.4/10)
            let imdbRating = $('a[href*="www.imdb.com/"] div.cbl', sideDetailsPanel).text() || '';
            if (imdbRating) {
                imdbRating = imdbRating.replace(/\//g, ' out of ');
            }

            movieDetails = {
                duration,
                imdbRating,
                rottenTomatoesRating: $('a[href*="www.rottentomatoes.com/"] div.cbl', sideDetailsPanel).text(),
                dates,
                movie: movie,
                showTimesPerDate,
                synopsis
            };

            return movieDetails;
        }).catch(err => {
            console.error('Caught error.', err);
            return null;
        });
    }

    /**
     * Get the IMovieFormatShowtimes[] for a given movie/date url
     */
    private _getMovieTheaterAndTimes(dateLabel: string, detailsUrl: string, startTimeToScopeTo: string, maxNumberShowtimesPerFormat: number)
        : Promise<IMovieFormatShowtimes[]> {
        let requestPromise = Promise.promisify(request);

        return requestPromise({
            url: detailsUrl,
            headers: {
                'User-Agent': UserAgent
            }
        }).then((response) => {
            if (response.statusCode !== 200) {
                throw new Error(`Got invalid response ${response.statusCode}`);
            }

            let body = (<any>response).body,
                $ = cheerio.load(body),
                result: Array<IMovieFormatShowtimes> = [];

            $('div.st_entityGroup').each((index, element) => {
                let theaterElement = $('span#st_entityName a', element),
                    theaterName = theaterElement.text(),
                    theaterDetailsUrl = UrlHelper.enforceAbsoluteUrl(theaterElement.attr('href'), BaseUrl);

                $('tr', element).each((innerIndex, innerElement) => {
                    let format = $('td.st_Format', innerElement).text(),
                        isPM: boolean = false, // only the 1st PM time is marked as PM - thus we need to keep track
                        numberConsecutiveResults: number = 0,
                        showTimes: IMovieShowtime[] = [];

                    $('ol li.st_lFloat', innerElement).each((showIndex, showElement) => {
                        let startTime = $(showElement).text() || '',
                            showActiveElement = $('a', showElement),
                            ticketUrl = $(showActiveElement).attr('href');

                        if (!isPM && startTime.toUpperCase().indexOf('PM') > -1) {
                            isPM = true;
                        }

                        // only consider the showtimes we can still get tickets (aka. have <a />) for
                        if (showActiveElement && ticketUrl) {
                            // get the time as Date
                            let startTimeAsDate = new Date(Date.parse(`1/1/2016 ${startTime}`)),
                                hh = startTimeAsDate.getHours(),
                                mm = startTimeAsDate.getMinutes();

                            if (isPM && hh < 12) {
                                hh += 12;
                            }

                            // scope by time if needed
                            let startTimeAsString = `${hh < 10 ? '0' + hh.toString() : hh.toString()}:${mm < 10 ? '0' + mm.toString() : mm.toString()}`;
                            // console.log(`${startTimeToScopeTo} ->? ${startTime} > ${hh}:${mm} > ${startTimeAsString} ?`);
                            if (!startTimeToScopeTo || startTimeToScopeTo <= startTimeAsString) {
                                // note - string comparison here for HH:mm works
                                numberConsecutiveResults++;
                                if (numberConsecutiveResults <= maxNumberShowtimesPerFormat) {
                                    // console.log(`${startTimeToScopeTo} ->? ${startTime} > ${hh}:${mm} > ${startTimeAsString} +++`);
                                    showTimes.push({
                                        startTime: startTimeAsString,
                                        ticketUrl
                                    });
                                }
                            }
                        }
                    });

                    if (showTimes.length > 0) {
                        result.push(<IMovieFormatShowtimes>{
                            name: format,
                            theater: {
                                name: theaterName,
                                detailsUrl: theaterDetailsUrl
                            },
                            showTimes
                        });
                    }
                });
            });

            return result;
        }).catch(err => {
            console.error('Caught error.', err);
            return [];
        });
    }

    /**
     * Compose the search query to get movie results
     * 
     * @param {string} [movieGenre] - The genre of the movie - mapped to the GenreType enum, if any.
     * @param {string} [city] - The city to be used as scope, if any.
     * @returns {string} - The matching search query.
     */
    private _composeSearchQuery(movieGenre: string, city: string): string {
        // example of query produced: comedy movies in theater in las vegas tomorrow
        let correctedCity = GeoHelper.tryGetFullCity((city || '').trim()),
            query = `${movieGenre || ''} movies in theater ${!correctedCity ? '' : 'in ' + correctedCity}`;

        return query;
    }
};

export = new MovieHelper;