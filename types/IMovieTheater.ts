import IMovieShowtime = require('./IMovieShowtime');

/**
 * Movie theater object model
 */
interface IMovieTheater {
    /**
     * Theater name
     */
    name: string;

    /**
     * Details request url
     */
    detailsUrl: string;
};

export = IMovieTheater;
