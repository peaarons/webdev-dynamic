import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { default as express } from 'express';
import { default as sqlite3 } from 'sqlite3';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const port = 8000;
const root = path.join(__dirname, 'public');
const template = path.join(__dirname, 'templates');

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
    let letter = req.params.letter.toUpperCase();
    console.log(letter);

    let query1 = 'SELECT * FROM fandango_score_comparison WHERE FILM LIKE ?'
    let query2 = 'SELECT * FROM films WHERE title LIKE ?'
    
    let p1 = dbSelect(query1, [`${letter}%`]);
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
            
            response = response.replace('$$MOVIE TITLES$$', response_body);
            res.status(200).type('html').send(response);
        }).catch((error) => {
            console.error(error);
            res.status(200).type('txt').send('File not found');
        });
    }).catch((error) => {
        console.log(error);
        res.status(200).type('txt').send('File not found');
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

            res.status(200).type('html').send(response);
        }).catch((error) => {
            res.status(200).type('txt').send('File not found');
        });
    }).catch((error) => {
        res.status(200).type('txt').send('Could not find film for ID' + film_id);
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
