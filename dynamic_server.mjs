import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const port = 8100;
const root = path.join(__dirname, 'public');
const template = path.join(__dirname, 'templates');

const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'misc']
const ID_MAP = [
    143, 37, 109, 115, 43, 35, 73, 62, 130, 48, 3, 1, 82, 66, 12, 56, 83, 
    107, 79, 64, 2, 117, 138, 65, 4, 93, 52, 111, 27, 49, 11, 98, 100, 74, 
    99, 145, 106, 125, 54, 5, 41, 119, 114, 141, 22, 112, 7, 113, 101, 131, 
    45, 146, 13, 86, 10, 89, 88, 124, 40, 133, 21, 87, 132, 129, 69, 60, 142, 
    70, 19, 92, 81, 134, 120, 51, 20, 80, 57, 31, 58, 24, 39, 76, 84, 26, 140, 
    59, 71, 9, 85, 97, 18, 139, 90, 28, 77, 104, 16, 123, 17, 50, 118, 110, 53, 
    34, 55, 44, 47, 30, 102, 67, 105, 75, 33, 15, 128, 136, 36, 135, 23, 95, 96, 
    103, 91, 122, 108, 6, 126, 121, 137, 72, 42, 46, 8, 25, 63, 144, 14, 61, 68, 
    78, 38, 94, 32, 116, 29, 127]

let app = express();
app.use(express.static(root));

const db = new sqlite3.Database(path.join(__dirname, 'fandango_score_comparison.sqlite3'), sqlite3.OPEN_READONLY, (err) => {
    if(err) {
        console.log('Error connecting to database.');
    } else {
        console.log('Successfully connected to database.');
    }
});

function dbSelect(query, params) {
    let p = new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if(err) {
                reject(err); 
            }
            else {
                resolve(rows);
            }
        });
    });
    return p;
};

app.get('/', (req, res) => {
    console.log('test');
    res.redirect('/titles/A');
});

app.get('/titles/:letter', (req, res) => {
    let letter = req.params.letter
    console.log(letter);

    let query1 = 'SELECT * FROM fandango_score_comparison WHERE FILM LIKE ? ORDER BY FILM ASC'
    let query2 = 'SELECT * FROM films WHERE title LIKE ?'

    let p1 = dbSelect(query1, [`${letter}%`]);

    if (letter === 'misc') {
        query1 = "SELECT * FROM fandango_score_comparison WHERE FILM LIKE '0%' OR FILM LIKE '1%' OR FILM LIKE '2%' OR FILM LIKE '3%' OR FILM LIKE '4%' OR FILM LIKE '5%' OR FILM LIKE '6%' OR FILM LIKE '7%' OR FILM LIKE '8%' OR FILM LIKE '9%' OR FILM LIKE '''%'"
        p1 = dbSelect(query1, []);
    } else {
        letter = letter.toUpperCase()
    }
    let p2 = fs.promises.readFile(path.join(template, 'index.html'), 'utf-8');

    Promise.all([p1,p2]).then((results) => {
        let response = results[1];
        let response_body = '';
        let film_id_promises = [];

        // create promises to query for each ID
        results[0].forEach((entry) => {
            let title = entry.FILM;

            let p3 = dbSelect(query2, [`%${title}%`])
                .then((films) => {
                    let films_results = films[0];
                    console.log(films_results);
                    return films_results.film_id;
                })
                .catch((error) => {
                    console.error(error);
                    return null;
                });

            film_id_promises.push(p3);
        });

        // generate links once all film_id promises resolve
        Promise.all(film_id_promises).then((film_ids) => {
            results[0].forEach((entry, index) => {
                let title = entry.FILM;
                let film_id = film_ids[index];
                response_body += '<a href="/film/' + film_id + '">' + title + '</a>' + '<br>';
            });
            
            if(response_body == '') {
                response_body = 'No Movie Titles Listed';
            }
            response = response.replace('$$MOVIE TITLES$$', response_body);
            //response = response.replace('$$LETTERS$$', "that start with  " + letter );
            response = response.replace('$$LETTERS$$',  letter );
            let next_letter = ALPHABET[ALPHABET.indexOf(letter) + 1];
            if (next_letter === undefined) {
                next_letter = ALPHABET[0];
            }
            let prev_letter = ALPHABET[ALPHABET.indexOf(letter) - 1];
            if (prev_letter === undefined) {
                prev_letter = ALPHABET[ALPHABET.length - 1];
            }
            let next_link = 'titles/' + next_letter
            let prev_link = 'titles/' + prev_letter
            response = response.replace('$$NEXT_LINK$$', next_link);
            response = response.replace('$$PREV_LINK$$', prev_link);

            res.status(200).type('html').send(response);
        }).catch((error) => {
            console.error(error);
            res.status(404).type('txt').send('File not found');
        });
    }).catch((error) => {
        console.log(error);
    });
});

app.get('/film/:film_id', (req, res) => {
    let film_id = req.params.film_id;
    let film_results = '';
    let film_title = '';
    console.log(film_id);

    let query1 = 'SELECT * FROM films WHERE film_id = ?';
    let query2 = 'SELECT * FROM fandango_score_comparison WHERE FILM LIKE ?';
    
    let p1 = dbSelect(query1, [film_id]);

    p1.then((film) => {
        film_results = film[0];
        film_title = film_results.title;
        console.log(film_title);
        let p2 = dbSelect(query2, [`%${film_title}%`]);
        let p3 = fs.promises.readFile(path.join(template, 'movie_ratings.html'), 'utf-8');
        Promise.all([p2, p3]).then((results) => {
            let ratings = results[0][0];
            let response = results[1];
            console.log(ratings);

            response = response.replace('$$MOVIE$$', ratings.FILM);
            response = response.replace('$$MOVIE TITLE$$', ratings.FILM);
            
            response = response.replace('$$FAN_STARS$$', ratings.Fandango_Stars).replace('$$NUM_FAN_STARS$$', ratings.Fandango_Stars);
            response = response.replace('$$FAN_RATE_VAL$$', ratings.Fandango_Ratingvalue)

            response = response.replace('$$META_CRIT_SCORE$$', ratings.Metacritic);
            response = response.replace('$$META_CRIT_SCORE_NORM$$', ratings.Metacritic_norm).replace('$$NUM_META_STARS$$', ratings.Metacritic_norm_round);
            response = response.replace('$$META_USER_SCORE$$', ratings.Metacritic_User);
            response = response.replace('$$META_USER_SCORE_NORM$$', ratings.Metacritic_user_nom).replace('$$NUM_META_USER_STARS$$', ratings.Metacritic_user_norm_round);

            response = response.replace('$$TOMATOMETER_SCORE$$', ratings.RottenTomatoes);
            response = response.replace('$$TOMATOMETER_SCORE_NORM$$', ratings.RT_norm).replace('$$NUM_TOM_STARS$$', ratings.RT_norm_round);
            response = response.replace('$$TOMATOE_USER_SCORE$$', ratings.RottenTomatoes_User);
            response = response.replace('$$TOMATOE_USER_SCORE_NORM$$', ratings.RT_user_norm).replace('$$NUM_TOM_USER_STARS$$', ratings.RT_user_norm_round);

            response = response.replace('$$IMDB_USER$$', ratings.IMDB);
            response = response.replace('$$IMDB_NORM$$', ratings.IMDB_norm).replace('$$NUM_IMDB_STARS$$', ratings.IMDB_norm_round);

            let chart_body = `
                '${ratings.Fandango_Stars}',
                '${ratings.Fandango_Ratingvalue}',
                '${ratings.Metacritic_norm}',
                '${ratings.Metacritic_user_nom}',
                '${ratings.RT_norm}',
                '${ratings.RT_user_norm}',
                '${ratings.IMDB_norm}',   
            `
            
            response = response.replace('$$MOVIE TITLE$$', ratings.FILM);
            response = response.replace("'$$DATA$$'", chart_body);

            let next_id = parseInt(film_id) + 1;
            if (next_id > 146) {
                next_id = 1;
            };
            let prev_id = parseInt(film_id) - 1;
            if (prev_id < 1) {
                prev_id = 146;
            };
            let next_link = 'film/' + next_id
            let prev_link = 'film/' + prev_id
            response = response.replace('$$NEXT_MOVIE_LINK$$', next_link);
            response = response.replace('$$PREV_MOVIE_LINK$$', prev_link);
            
            res.status(200).type('html').send(response);
        }).catch((error) => {
            console.error(error)
            res.status(200).type('txt').send('File not found');
        });
    }).catch((error) => {
        console.log(error);
        res.status(404).type('txt').send('Could not find film for ID' + film_id);
    });
});

app.get('/stars/:stars', (req, res) => {
//app.get('/stars/:stars(\\d+-\\d+)', (req, res) => {
    let stars = req.params.stars;
   /*
    let lo_star = null;
    let hi_star = null;
    
    if (stars === '5-4') {
        lo_star = 4;
        hi_star = 5;
    } else if (stars === '3-2') {
        lo_star = 2;
        hi_star = 3;
    } else if (stars === '1-0') {
        lo_star = 0;
        hi_star = 1;
    } else {
        throw 'Unsupported range ' + stars
    }
    */

    //let query1 = 'SELECT * FROM fandango_score_comparison WHERE Fandango_Stars BETWEEN ? AND ?';
    let query1 = 'SELECT * FROM fandango_score_comparison WHERE Fandango_Stars LIKE ?';
    let query2 = 'SELECT * FROM films WHERE title LIKE ?';

    //let p1 = dbSelect(query1, [lo_star, hi_star]);
    let p1 = dbSelect(query1, stars);
    let p2 = fs.promises.readFile(path.join(template, 'index.html'), 'utf-8');

    Promise.all([p1, p2]).then((results) => {
        let response = results[1];
        console.log(results[0]);
        let response_body = '';
        let film_id_promises = [];

        // create promises to query for each ID
        results[0].forEach((entry) => {
            let title = entry.FILM;

            let p3 = dbSelect(query2, [`%${title}%`])
                .then((films) => {
                    let films_results = films[0];
                    console.log(films_results);
                    return films_results.film_id;
                })
                .catch((error) => {
                    console.log(error);
                    res.status(404).type('txt').send('Could not find '+ title + ' in database');
                });

            film_id_promises.push(p3);
        });

        Promise.all(film_id_promises).then((film_ids) => {
            //response = response.replace('$$LETTERS$$', "that have "+ stars + " stars");
            response = response.replace('$$LETTERS$$',  stars + " stars");
            results[0].forEach((entry, index) => {
                let title = entry.FILM;
                let film_id = film_ids[index];
                response_body += '<a href="/film/' + film_id + '">' + title + '</a>' + '<br>';
            });

            if (response_body == '') {
                response_body = 'No Movie Titles Listed';
            }
            let next_star = parseInt(stars) + 1;
            if (stars ==5) {
                next_star= 1;
            }
            let prev_star = parseInt(stars) - 1;
            if (stars ==1) {
                prev_star= 5;
            }
            let next_link = 'stars/' + next_star
            let prev_link = 'stars/' + prev_star
            response = response.replace('$$NEXT_LINK$$', next_link);
            response = response.replace('$$PREV_LINK$$', prev_link);

            response = response.replace('$$MOVIE TITLES$$', response_body);
            res.status(200).type('html').send(response);
        }).catch((error) => {
            console.error(error);
            res.status(404).type('txt').send('Error getting film_ids in database');
        });
    }).catch((error) => {
        console.error(error);
        res.status(404).type('txt').send(error);
    });

});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
