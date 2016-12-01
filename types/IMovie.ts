import GenreType = require('./GenreType');
import IMovieDetails = require('./IMovieDetails');

/**
 * Movie object model
 */
interface IMovie {
    /**
     * Movie name
     */
    name: string;

    /**
     * Movie year
     */
    year: number;

    /**
     * MPAA rating
     */
    rating: string;

    /**
     * Movie genre
     */
    genre: GenreType;

    /**
     * Movie cover
     */
    coverUrl: string;

    /**
     * Details request url
     */
    detailsUrl: string;
};

export = IMovie;
