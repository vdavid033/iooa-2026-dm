const connection = require('../data/db');

exports.getLatestTopics = async (req, res) => {
  try {
    const [results] = await connection.query(`
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
    `)
    res.status(200).json(results)
  } catch (err) {
    console.error('Greška pri dohvaćanju tema:', err)
    res.status(500).json({ error: 'Greška pri dohvaćanju tema.' })
  }
}