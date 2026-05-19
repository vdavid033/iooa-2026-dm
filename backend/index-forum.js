// API
const express = require('express')
const mysql = require('mysql2')
const cors = require('cors')
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const config = require("./auth_config.js");
const authJwt = require("./authJwt.js");


const app = express()
app.use(cors())
app.use(express.json())

const db = mysql.createConnection({
  host: 'student.veleri.hr',
  user: 'iooa',
  password: '11',
  database: 'iooa_dm_veleri'
})

db.connect(err => {
  if (err) {
    console.error(' Greška pri spajanju na bazu:', err)
  } else {
    console.log(' Spojeno na MySQL bazu!')
  }
})


app.post('/api/objave', authJwt.verifyTokenUser, (req, res) => {

  const { naslov, sadrzaj, datum, fk_kategorija, tagovi } = req.body;
  const fk_korisnik = req.userId; // dolazi iz tokena

  if (!naslov || !sadrzaj || !datum || !fk_korisnik) {
    return res.status(400).json({ error: 'Nedostaju podaci.' });
  }

  const sqlObjava = `
    INSERT INTO objava (naslov_objave, sadrzaj_objave, datum_objave, fk_korisnik, fk_kategorija)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sqlObjava, [naslov, sadrzaj, datum, fk_korisnik, fk_kategorija], (err, result) => {
    if (err) return res.status(500).json({ error: 'Greška pri unosu objave.' });

    const id_objava = result.insertId;

    if (Array.isArray(tagovi) && tagovi.length > 0) {
      const tagSql = `INSERT INTO objava_tag (fk_objava, fk_tag) VALUES ?`;
      const tagVrijednosti = tagovi.map(tagId => [id_objava, tagId]);

      db.query(tagSql, [tagVrijednosti], (tagErr) => {
        if (tagErr) {
          console.error('Greška pri tagovima:', tagErr);
          return res.status(500).json({ error: 'Objava spremljena, ali tagovi nisu.' });
        }

        res.status(201).json({ message: 'Objava i tagovi spremljeni!', id_objava });
      });
    } else {
      res.status(201).json({ message: 'Objava spremljena bez tagova.', id_objava });
    }
  });
});


// GET: Sve objave
app.get('/api/objave', (req, res) => {
  const sql = `
    SELECT 
      o.id_objava AS id,
      o.naslov_objave AS title,
      LEFT(o.sadrzaj_objave, 200) AS preview,
      o.datum_objave AS date,
      k.korisnicko_ime AS author,
      kf.ime_kategorija_forum AS category,
      o.id_objava
    FROM objava o
    LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
    LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
    ORDER BY o.datum_objave DESC
  `

  db.query(sql, async (err, results) => {
    if (err) {
      console.error(' Greška pri dohvaćanju objava:', err)
      return res.status(500).json({ error: 'Greška pri dohvaćanju objava.' })
    }

    const postIds = results.map(r => r.id)
    if (postIds.length === 0) return res.json([])

    const tagSql = `
      SELECT ot.fk_objava, t.naziv_tag
      FROM objava_tag ot
      JOIN tag t ON ot.fk_tag = t.id_tag
      WHERE ot.fk_objava IN (?)
    `
    db.query(tagSql, [postIds], (tagErr, tagResults) => {
      if (tagErr) {
        console.error(' Greška pri dohvaćanju tagova za objave:', tagErr)
        return res.status(500).json({ error: 'Greška pri dohvaćanju tagova.' })
      }

      const tagMap = {}
      tagResults.forEach(({ fk_objava, naziv_tag }) => {
        if (!tagMap[fk_objava]) tagMap[fk_objava] = []
        tagMap[fk_objava].push(naziv_tag)
      })

      // Novi SQL koji dohvaća broj komentara po objavi
const komentariSql = `
  SELECT id_objava, COUNT(*) AS broj_komentara
  FROM komentar
  GROUP BY id_objava
`

db.query(komentariSql, (komErr, komResults) => {
  if (komErr) {
    console.error('❌ Greška pri dohvaćanju broja komentara:', komErr)
    return res.status(500).json({ error: 'Greška pri komentarima.' })
  }

  const komentarMap = {}
  komResults.forEach(({ id_objava, broj_komentara }) => {
    komentarMap[id_objava] = broj_komentara
  })

  const finalResults = results.map(post => ({
    ...post,
    tags: tagMap[post.id] || [],
    comments: komentarMap[post.id] || 0  // 💬 stvarni broj komentara
  }))

  res.json(finalResults)
})

    })
  })
})

//  GET: Filtrirane objave po tagovima
app.get('/api/objave/filtrirane', (req, res) => {
  const { tagovi } = req.query
  if (!tagovi) {
    return res.status(400).json({ error: 'Tagovi nisu poslani u upitu.' })
  }

  const tagList = tagovi.split(',')
  const placeholders = tagList.map(() => '?').join(',')

  const sql = `
    SELECT DISTINCT 
      o.id_objava AS id,
      o.naslov_objave AS title,
      LEFT(o.sadrzaj_objave, 200) AS preview,
      o.datum_objave AS date,
      k.korisnicko_ime AS author,
      kf.ime_kategorija_forum AS category
    FROM objava o
    JOIN objava_tag ot ON o.id_objava = ot.fk_objava
    JOIN tag t ON ot.fk_tag = t.id_tag
    LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
    LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
    WHERE t.naziv_tag IN (${placeholders})
    ORDER BY o.datum_objave DESC
  `

  db.query(sql, tagList, (err, results) => {
    if (err) {
      console.error(' Greška pri filtriranju objava po tagovima:', err)
      return res.status(500).json({ error: 'Greška pri dohvaćanju filtriranih objava.' })
    }

    const postIds = results.map(r => r.id)
    if (postIds.length === 0) return res.json([])

    const tagSql = `
      SELECT ot.fk_objava, t.naziv_tag
      FROM objava_tag ot
      JOIN tag t ON ot.fk_tag = t.id_tag
      WHERE ot.fk_objava IN (?)
    `
    db.query(tagSql, [postIds], (tagErr, tagResults) => {
      if (tagErr) {
        console.error(' Greška pri dohvaćanju tagova za filtrirane objave:', tagErr)
        return res.status(500).json({ error: 'Greška pri dohvaćanju tagova.' })
      }

      const tagMap = {}
      tagResults.forEach(({ fk_objava, naziv_tag }) => {
        if (!tagMap[fk_objava]) tagMap[fk_objava] = []
        tagMap[fk_objava].push(naziv_tag)
      })

      const finalResults = results.map(post => ({
        ...post,
        tags: tagMap[post.id] || [],
        comments: 0
      }))

      res.json(finalResults)
    })
  })
})



// GET: Dohvati kategorije
app.get('/api/kategorije', (req, res) => {
  const sql = `
    SELECT id_kategorija_forum AS value, ime_kategorija_forum AS label
    FROM kategorija_forum
    ORDER BY label ASC
  `

  db.query(sql, (err, results) => {
    if (err) {
      console.error(' Greška pri dohvaćanju kategorija:', err)
      return res.status(500).json({ error: 'Greška pri dohvaćanju kategorija.' })
    }

    res.status(200).json(results)
  })
})

// GET: Dohvati sve tagove
app.get('/api/tagovi', (req, res) => {
  db.query('SELECT id_tag AS value, naziv_tag AS label FROM tag', (err, results) => {
    if (err) return res.status(500).json({ error: 'Greška u bazi' })
    res.status(200).json(results)
  })
})

// POST: Spremi komentar
app.post('/api/comments', authJwt.verifyTokenUser, (req, res) => {
  const { id_objava, sadrzaj_komentara } = req.body
  const id_korisnika = req.userId  // ✅ iz tokena

  if (!id_objava || !sadrzaj_komentara || !id_korisnika) {
    return res.status(400).json({ error: 'Nedostaju podaci.' })
  }

  const sql = `
    INSERT INTO komentar (id_objava, id_korisnika, sadrzaj_komentara, datum_komentara)
    VALUES (?, ?, ?, NOW())
  `

  db.query(sql, [id_objava, id_korisnika, sadrzaj_komentara], (err, result) => {
    if (err) {
      console.error('❌ Greška pri unosu komentara:', err)
      return res.status(500).json({ error: 'Greška pri unosu komentara.' })
    }

    res.status(201).json({ message: 'Komentar spremljen!', id_komentar: result.insertId })
  })
})

// GET: Dohvati komentare za objavu
app.get('/api/comments/:id_objava', (req, res) => {
  const id_objava = req.params.id_objava;

  const sql = `
    SELECT 
      k.id_komentar,
      k.id_objava,
      k.id_korisnika,
      k.sadrzaj_komentara,
      k.datum_komentara,
      u.korisnicko_ime AS username
    FROM komentar k
    LEFT JOIN korisnik u ON k.id_korisnika = u.id_korisnika
    WHERE k.id_objava = ?
    ORDER BY k.datum_komentara DESC
  `;

  db.query(sql, [id_objava], (err, results) => {
    if (err) {
      console.error('❌ Greška pri dohvaćanju komentara:', err);
      return res.status(500).json({ error: 'Greška u bazi.' });
    }

    const komentari = results.map(r => ({
      id_komentar: r.id_komentar,
      id_objava: r.id_objava,
      id_korisnika: r.id_korisnika,
      sadrzaj_komentara: r.sadrzaj_komentara,
      datum_komentara: r.datum_komentara,
      username: r.username || null
    }));

    res.status(200).json(komentari);
  });
});

app.get('/api/objave/:id', (req, res) => {
  const id = req.params.id

  const sql = `
    SELECT 
  o.id_objava AS id,
  o.naslov_objave AS naslov,
  o.sadrzaj_objave AS sadrzaj,
  o.datum_objave,
  o.fk_korisnik AS id_korisnika,
  k.korisnicko_ime AS username,
  kf.ime_kategorija_forum AS kategorija
FROM objava o
LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
WHERE o.id_objava = ?
  `

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error('❌ Greška pri dohvaćanju objave:', err)
      return res.status(500).json({ error: 'Greška u bazi.' })
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Objava nije pronađena.' })
    }

    const post = results[0]

    const tagSql = `
      SELECT t.naziv_tag
      FROM objava_tag ot
      JOIN tag t ON ot.fk_tag = t.id_tag
      WHERE ot.fk_objava = ?
    `

    db.query(tagSql, [id], (tagErr, tagResults) => {
      if (tagErr) {
        console.error('❌ Greška pri dohvaćanju tagova:', tagErr)
        return res.status(500).json({ error: 'Greška pri tagovima.' })
      }

      post.tagovi = tagResults.map(r => r.naziv_tag)
      res.status(200).json(post)
    })
  })
})

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  db.query("SELECT * FROM korisnik WHERE korisnicko_ime = ?", [username], (error, results) => {
    if (error) return res.status(500).json({ success: false, message: error });

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: "Korisnik ne postoji" });
    }

    const korisnik = results[0];

    bcrypt.compare(String(password), String(korisnik.lozinka_korisnika), (err, isMatch) => {
      if (err) return res.status(500).json({ success: false, message: err });

      if (isMatch) {
        const token = jwt.sign(
          {
            id: korisnik.id_korisnika,
            ime: korisnik.ime_korisnika,
            prezime: korisnik.prezime_korisnika,
            uloga: korisnik.admin_status
          },
          config.secret,
          { expiresIn: "2h" }
        );
        return res.status(200).json({ success: true, token });
      } else {
        return res.status(401).json({ success: false, message: "Krivo korisničko ime ili lozinka" });
      }
    });
  });
});

app.get("/api/me", authJwt.verifyTokenUser, (req, res) => {
  db.query("SELECT id_korisnika AS id, korisnicko_ime AS ime, admin_status AS uloga FROM korisnik WHERE id_korisnika = ?", [req.userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Greška u bazi" });
    if (results.length === 0) return res.status(404).json({ error: "Korisnik nije pronađen" });
    res.status(200).json(results[0]);
  });
});

// GET: Zadnje 5 tema za početnu stranicu
app.get('/api/forum/latest', authJwt.verifyTokenUser, (req, res) => {
  const sql = `
    SELECT 
      o.id_objava AS id,
      o.naslov_objave AS title,
      o.datum_objave AS date,
      k.korisnicko_ime AS author,
      kf.ime_kategorija_forum AS category
    FROM objava o
    LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
    LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
    ORDER BY o.datum_objave DESC
    LIMIT 5
  `

  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Greška pri dohvaćanju zadnji tema:', err)
      return res.status(500).json({ error: 'Greška pri dohvaćanju tema.' })
    }
    res.status(200).json(results)
  })
})



// Pokretanje servera
const PORT = 3000
app.listen(PORT, () => {
  console.log(`🚀 Backend radi na http://localhost:${PORT}`)
})
