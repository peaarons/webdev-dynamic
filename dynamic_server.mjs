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
app.use(express.static(template));

const db = new sqlite3.Database(path.join(__dirname, 'fandango_score_comparison.sqlite3'), sqlite3.OPEN_READONLY, (err) => {
    if(err) {
        console.log('Error connecting to database.');
    } else {
        console.log('Successfully connected to database.');
    }


});

app.get('/index.html/:letter', (req, res) => {
    let letter = req.params.letter;
    console.log(letter);
    fs.readFile(path.join(root, 'index.html'), 'utf-8', (err, data) => {
        if (err) {
            res.status(404).type('txt').send('File Not Found.');
        }
        res.status(200).type('html').send(data);
    });
});

app.listen(port, () => {
    console.log('Now listening on port ' + port);
});
