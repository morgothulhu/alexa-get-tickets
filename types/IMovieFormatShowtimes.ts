import IMovieShowtime = require('./IMovieShowtime');
import IMovieTheater = require('./IMovieTheater');

/**
 * Movie format object model
 */
interface IMovieFormatShowtimes {
    /**
     * Movie format name (e.g. Standard, 3D)
     */
    name: string;

    /**
     * Showtimes
     */
    showTimes: Array<IMovieShowtime>;

    /**
     * Theater
     */
    theater: IMovieTheater;
};

export = IMovieFormatShowtimes;
