const db = require('../db')

// Helper: enrich posts with tags and comment counts
function enrichPosts(results, res) {
  if (results.length === 0) return res.json([])
  const postIds = results.map(r => r.id)

  const tagSql = `
    SELECT ot.fk_objava, t.naziv_tag
    FROM objava_tag ot
    JOIN tag t ON ot.fk_tag = t.id_tag
    WHERE ot.fk_objava IN (?)
  `
  db.query(tagSql, [postIds], (tagErr, tagResults) => {
    if (tagErr) return res.status(500).json({ error: 'Greska pri dohvacanju tagova.' })

    const tagMap = {}
    tagResults.forEach(({ fk_objava, naziv_tag }) => {
      tagMap[String(fk_objava)] = tagMap[String(fk_objava)] || []
tagMap[String(fk_objava)].push(naziv_tag)
    })

    const komentarSql = `
      SELECT id_objava, COUNT(*) AS broj_komentara
      FROM komentar
      WHERE id_objava IN (?)
      GROUP BY id_objava
    `
    db.query(komentarSql, [postIds], (komErr, komResults) => {
      if (komErr) return res.status(500).json({ error: 'Greska pri komentarima.' })

      const komentarMap = {}
      komResults.forEach(({ id_objava, broj_komentara }) => {
        komentarMap[id_objava] = broj_komentara
      })

      const finalResults = results.map(post => ({
        ...post,
        tags: tagMap[String(post.id)] || [],
        comments: komentarMap[post.id] || 0,
      }))

      res.json(finalResults)
    })
  })
}

// K6: Search by keyword
exports.searchObjave = (req, res) => {
  const q = (req.query.q || '').trim()

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Unesite najmanje 2 znaka za pretrazivanje.' })
  }
  if (q.length > 200) {
    return res.status(400).json({ error: 'Upit je predugacak (max 200 znakova).' })
  }

  const keyword = '%' + q + '%'
  const sql = `
    SELECT o.id_objava AS id,
           o.naslov_objave AS title,
           LEFT(o.sadrzaj_objave, 200) AS preview,
           o.datum_objave AS date,
           o.edited_at,
           o.edit_count,
           o.fk_korisnik AS authorId,
           k.korisnicko_ime AS author,
           kf.ime_kategorija_forum AS category
    FROM objava o
    LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
    LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
    WHERE o.naslov_objave LIKE ?
       OR o.sadrzaj_objave LIKE ?
    ORDER BY o.datum_objave DESC
  `
  db.query(sql, [keyword, keyword], (err, results) => {
    if (err) return res.status(500).json({ error: 'Greska pri pretrazivanju.' })
    enrichPosts(results, res)
  })
}

// K7: Get posts by user (as author or commenter)
exports.getObjaveByUser = (req, res) => {
  const korisnik_id = req.query.korisnik_id

  if (!korisnik_id) {
    return res.status(400).json({ error: 'Parametar korisnik_id je obavezan.' })
  }
  const id = parseInt(korisnik_id, 10)
  if (isNaN(id) || id <= 0) {
    return res.status(400).json({ error: 'korisnik_id mora biti pozitivan broj.' })
  }

  const sql = `
    SELECT DISTINCT
           o.id_objava AS id,
           o.naslov_objave AS title,
           LEFT(o.sadrzaj_objave, 200) AS preview,
           o.datum_objave AS date,
           o.edited_at,
           o.edit_count,
           o.fk_korisnik AS authorId,
           k.korisnicko_ime AS author,
           kf.ime_kategorija_forum AS category
    FROM objava o
    LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
    LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
 LEFT JOIN komentar kom ON kom.id_objava = o.id_objava
WHERE o.fk_korisnik = ?
   OR kom.id_korisnika = ?
    ORDER BY o.datum_objave DESC
  `
  db.query(sql, [id, id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Greska pri filtriranju po korisniku.' })
    enrichPosts(results, res)
  })
}

// K7: List of users for dropdown
exports.getKorisnici = (req, res) => {
  const sql = `
    SELECT id_korisnika AS id, korisnicko_ime AS label
    FROM korisnik
    ORDER BY korisnicko_ime ASC
  `
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Greska pri dohvacanju korisnika.' })
    res.json(results)
  })
}

// CREATE
exports.createObjava = (req, res) => {
  const { naslov, sadrzaj, datum, fk_kategorija, tagovi } = req.body
  const fk_korisnik = req.user.id

  if (!naslov || !sadrzaj || !datum || !fk_korisnik) {
    return res.status(400).json({ error: 'Nedostaju podaci.' })
  }

  const sql = `
    INSERT INTO objava (naslov_objave, sadrzaj_objave, datum_objave, fk_korisnik, fk_kategorija)
    VALUES (?, ?, ?, ?, ?)
  `
  db.query(sql, [naslov, sadrzaj, datum, fk_korisnik, fk_kategorija], (err, result) => {
    if (err) return res.status(500).json({ error: 'Greska pri unosu objave.' })

    const id_objava = result.insertId
    if (Array.isArray(tagovi) && tagovi.length > 0) {
      const tagSql = `INSERT INTO objava_tag (fk_objava, fk_tag) VALUES ?`
      const tagValues = tagovi.map(tagId => [id_objava, tagId])
      db.query(tagSql, [tagValues], tagErr => {
        if (tagErr) {
          console.error(tagErr)
          return res.status(500).json({ error: 'Objava spremljena, ali tagovi nisu.' })
        }
        res.status(201).json({ message: 'Objava i tagovi spremljeni!', id_objava })
      })
    } else {
      res.status(201).json({ message: 'Objava spremljena bez tagova.', id_objava })
    }
  })
}

// GET ALL
exports.getAllObjave = (req, res) => {
  const sql = `
    SELECT o.id_objava AS id,
           o.naslov_objave AS title,
           LEFT(o.sadrzaj_objave, 200) AS preview,
           o.datum_objave AS date,
           o.edited_at,
           o.edit_count,
           o.fk_korisnik AS authorId,
           k.korisnicko_ime AS author,
           kf.ime_kategorija_forum AS category
    FROM objava o
    LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
    LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
    ORDER BY o.datum_objave DESC
  `
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: 'Greska pri dohvacanju objava.' })
    enrichPosts(results, res)
  })
}

// GET FILTERED by tag
exports.getFilteredObjave = (req, res) => {
  const { tagovi } = req.query
  if (!tagovi) return res.status(400).json({ error: 'Tagovi nisu poslani.' })

  const tagList = tagovi.split(',')
  const placeholders = tagList.map(() => '?').join(',')
  const sql = `
    SELECT DISTINCT o.id_objava AS id,
                    o.naslov_objave AS title,
                    LEFT(o.sadrzaj_objave, 200) AS preview,
                    o.datum_objave AS date,
                    o.edited_at,
                    o.edit_count,
                    o.fk_korisnik AS authorId,
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
    if (err) return res.status(500).json({ error: 'Greska pri filtriranju.' })
    enrichPosts(results, res)
  })
}

// GET BY ID
exports.getObjavaById = (req, res) => {
  const id = req.params.id
  const sql = `
    SELECT o.id_objava AS id,
           o.naslov_objave AS naslov,
           o.naslov_objave AS title,
           o.sadrzaj_objave AS sadrzaj,
           o.datum_objave,
           o.edited_at,
           o.edit_count,
           o.fk_korisnik AS id_korisnika,
           o.fk_korisnik AS authorId,
           o.fk_kategorija,
           k.korisnicko_ime AS username,
           kf.ime_kategorija_forum AS kategorija
    FROM objava o
    LEFT JOIN korisnik k ON o.fk_korisnik = k.id_korisnika
    LEFT JOIN kategorija_forum kf ON o.fk_kategorija = kf.id_kategorija_forum
    WHERE o.id_objava = ?
  `
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Greska u bazi.' })
    if (results.length === 0) return res.status(404).json({ error: 'Objava nije pronadjena.' })

    const post = results[0]
    const tagSql = `SELECT t.naziv_tag FROM objava_tag ot JOIN tag t ON ot.fk_tag = t.id_tag WHERE ot.fk_objava = ?`
    db.query(tagSql, [id], (tagErr, tagResults) => {
      if (tagErr) return res.status(500).json({ error: 'Greska pri tagovima.' })
      post.tagovi = tagResults.map(r => r.naziv_tag)
      res.status(200).json(post)
    })
  })
}

// UPDATE
exports.updateObjava = (req, res) => {
  const { id } = req.params
  const { naslov, sadrzaj, fk_kategorija, tagovi } = req.body

  console.log('UPDATE OBJAVA - Full Edit Mode')
  console.log('Request data:', { naslov, sadrzaj, fk_kategorija, tagovi })

  if (!req.user || !req.user.id) {
    return res.status(403).json({ error: 'Korisnik nije autenticiran', success: false })
  }

  const fk_korisnik = req.user.id
  const errors = {}

  if (!naslov || naslov.trim().length === 0) {
    errors.naslov = 'Naslov objave je obavezan'
  } else if (naslov.length > 100) {
    errors.naslov = 'Naslov ne moze biti duzi od 100 znakova'
  }

  if (!sadrzaj || sadrzaj.trim().length === 0) {
    errors.sadrzaj = 'Sadrzaj objave je obavezan'
  } else if (sadrzaj.length > 256) {
    errors.sadrzaj = 'Sadrzaj ne moze biti duzi od 256 znakova'
  }

  if (!fk_kategorija) {
    errors.kategorija = 'Kategorija je obavezna'
  }

  if (tagovi && Array.isArray(tagovi) && tagovi.length > 5) {
    errors.tagovi = 'Maksimalno 5 tagova je dozvoljeno'
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: Object.values(errors).join(', '), errors, success: false })
  }

  const checkSql = 'SELECT * FROM objava WHERE id_objava = ? AND fk_korisnik = ?'
  db.query(checkSql, [id, fk_korisnik], (err, results) => {
    if (err) {
      console.error('Database error during ownership check:', err)
      return res.status(500).json({ error: 'Greska na serveru' })
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Objava nije pronadjena ili nemate dozvolu za uredivanje' })
    }

    const updateObjavaSQL = `
      UPDATE objava
      SET naslov_objave = ?,
          sadrzaj_objave = ?,
          fk_kategorija = ?,
          edited_at = CURRENT_TIMESTAMP,
          edit_count = edit_count + 1
      WHERE id_objava = ? AND fk_korisnik = ?
    `
    db.query(updateObjavaSQL, [naslov.trim(), sadrzaj.trim(), fk_kategorija, id, fk_korisnik], (updateErr) => {
      if (updateErr) {
        console.error('Objava update error:', updateErr)
        return res.status(500).json({ error: 'Greska pri azuriranju objave' })
      }

      updateTags(id, tagovi, (tagError) => {
        if (tagError) {
          console.error('Tags update error:', tagError)
          return res.status(500).json({ error: 'Objava azurirana, ali greska pri tagovima' })
        }

        res.json({
          success: true,
          message: 'Objava uspjesno azurirana',
          objava: {
            id: parseInt(id),
            naslov: naslov.trim(),
            sadrzaj: sadrzaj.trim(),
            fk_kategorija,
            tagovi: tagovi || [],
            edited_at: new Date().toISOString(),
          },
        })
      })
    })
  })
}

// Helper: update tags
function updateTags(objavaId, newTagovi, callback) {
  const deleteTagsSQL = 'DELETE FROM objava_tag WHERE fk_objava = ?'
  db.query(deleteTagsSQL, [objavaId], (deleteErr) => {
    if (deleteErr) return callback(deleteErr)

    if (!newTagovi || !Array.isArray(newTagovi) || newTagovi.length === 0) {
      return callback(null)
    }

    const insertTagsSQL = 'INSERT INTO objava_tag (fk_objava, fk_tag) VALUES ?'
    const tagValues = newTagovi.map(tagId => [objavaId, tagId])
    db.query(insertTagsSQL, [tagValues], (insertErr) => {
      if (insertErr) return callback(insertErr)
      callback(null)
    })
  })
}
