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
    res.redirect('/index.html/A');
});

app.get('/index.html/:letter', (req, res) => {
    let letter = req.params.letter.toUpperCase();
    console.log(letter);

    let query1 = 'SELECT * FROM fandango_score_comparison WHERE FILM LIKE ?'
    
    let p1 = dbSelect(query1, [`${letter}%`]);
    let p2 = fs.promises.readFile(path.join(template, 'index.html'), 'utf-8');

    Promise.all([p1,p2]).then((results) => {
        let response = results[1];
        console.log(results[0]);

        let response_body = '';
        results[0].forEach((entry) => {
            response_body += entry.FILM + '<br>';
        });
        console.log(response_body);
        response = response.replace('$$MOVIE TITLES$$', response_body);
        res.status(200).type('html').send(response);
    }).catch((error) => {
        res.status(200).type('txt').send('File not found');
    });

    // fs.readFile(path.join(template, 'index.html'), 'utf-8', (err, data) => {
    //     if (err) {
    //         res.status(404).type('txt').send('File Not Found.');
    //     }
    //     res.status(200).type('html').send(data);
    // });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
