const express = require('express')
const router = express.Router()
const controller = require('../controllers/objavaController')
const { verifyTokenUser } = require('../authJwt')

// PUBLIC ROUTES (no token required)
router.get('/', controller.getAllObjave)
router.get('/filtrirane', controller.getFilteredObjave)
router.get('/search', controller.searchObjave)
router.get('/byuser', controller.getObjaveByUser)
router.get('/korisnici', controller.getKorisnici)
router.get('/:id', controller.getObjavaById)

// PROTECTED ROUTES (token required)
router.post('/', verifyTokenUser, controller.createObjava)
router.put('/:id', verifyTokenUser, controller.updateObjava)

module.exports = router
