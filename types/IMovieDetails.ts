import IMovie = require('./IMovie');
import IMovieFormatShowtimes = require('./IMovieFormatShowtimes');

interface HashTable<V> {
    [key: string]: V;
}

/**
 * Movie details object model
 */
interface IMovieDetails {
    /**
     * Movie
     */
    movie: IMovie;

    /**
     * Duration (e.g. 1hr 53min)
     */
    duration: string;

    /**
     * IMDB rating
     */
    imdbRating: string;

    /**
     * Rotten Tomatoes rating
     */
    rottenTomatoesRating: string;

    /**
     * Synopsis
     */
    synopsis: string;

    /**
     * Get dates
     */
    dates: string[];

    /**
     * Get showtimes per date
     */
    showTimesPerDate: HashTable<Array<IMovieFormatShowtimes>>;
};

export = IMovieDetails;
