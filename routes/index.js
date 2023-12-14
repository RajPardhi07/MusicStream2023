var express = require('express');
const passport = require('passport');
var router = express.Router();
var userModel = require('../models/userModel');
var songModel = require('../models/songModel');
var playlistModel = require('../models/playlistModel')
var localStrategy = require('passport-local')
passport.use(new localStrategy(userModel.authenticate()))
var multer = require('multer')
var id3 = require('node-id3')
var crypto = require('crypto')
const { Readable } = require('stream')
const mongoose = require('mongoose');
// const { CLIENT_RENEG_LIMIT } = require('tls');

// connect nodejs to mongodb
mongoose.connect('mongodb+srv://rajpardhi962000:88888@music23.qmcp0tz.mongodb.net/music23?retryWrites=true&w=majority').then(() => {
  console.log("connected to database")
}).catch(err => {
  console.log(err)
})
// mongoose.connect('mongodb://0.0.0.0/spt-n15').then(() => {
//   console.log("connected to database")
// }).catch(err => {
//   console.log(err)
// })
router.get('/poster/:posterName', (req, res, next) => {
  gfsBucketPoster.openDownloadStreamByName(req.params.posterName).pipe(res)
})

// get the poster
const conn = mongoose.connection

var gfsBucket, gfsBucketPoster
conn.once('open', () => {
  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'audio'
  })

  gfsBucketPoster = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'poster'
  })
})






/* GET home page. */
router.get('/', isloggedIn, async function (req, res, next) {

  const currentUser = await userModel.findOne({
    _id: req.user._id,
  }).populate('playlist').populate({
    path: 'playlist',
    populate: {
      path: 'songs',
      model: 'song'
    }
  })

  // console.log(JSON.stringify(currentUser))
  res.render('index', { currentUser });
});




// user authentication

router.post('/register', async (req, res, next) => {
  var newUser = {

    // user data here
    username: req.body.username,
    email: req.body.email
  }

  userModel.register(newUser, req.body.password)
    .then((result) => {
      passport.authenticate('local')(req, res, async () => {

        const songs = await songModel.find()
        const defaultplaylist = await playlistModel.create({
          username: req.body.username,
          owner: req.user._id,
          songs: songs.map(song => song._id )
        })

        const newUser = await userModel.findOne({
          _id: req.user._id
        })

        newUser.playlist.push(defaultplaylist._id)
        await newUser.save()
        res.redirect('/')
      })
    })
    .catch((err) => {
      res.send(err)
    })
})

router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
}), (req, res, next) => { }
);

router.get('/auth', (req, res, next) => {
  res.render('register')
})

router.get('/login', (req, res, next) => {
  res.render('login')
})

router.get('/logout', (req, res, next) => {
  if (req.isAuthenticated())
    req.logout((err) => {
      if (err) res.send(err)
      else res.redirect('/')
    })
  else {
    res.redirect('/')
  }
})



function isloggedIn(req, res, next) {
  if (req.isAuthenticated())
    return next();
  else res.redirect('/auth')
}

function isAdmin(req, res, next) {
  if (req.user.isAdmin) return next()                 // req.user - jo user loggedin hai or req.user.isAdmin - means jo user admin bi ho ar loggedin bhi
  else return res.redirect('/')
}
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })
router.post('/uploadMusic', isloggedIn, isAdmin, upload.array('song'), async (req, res, next) => {

  await Promise.all(req.files.map(async file => {

    // crypto create random name for song
    const randomName = crypto.randomBytes(20).toString('hex')
    const songData = id3.read(file.buffer)   // this is for play music

    // for uploading the music
    Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(randomName))
    // for uploading the poster
    Readable.from(songData.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(randomName + 'poster'))

    await songModel.create({
      title: songData.title,
      artist: songData.artist,
      album: songData.album,
      size: file.size,
      poster: randomName + 'poster',
      fileName: randomName
    })

  }))
  res.send('song uploaded')
})


router.get('/uploadMusic', isloggedIn, isAdmin, (req, res, next) => {
  res.render('uploadMusic')
})

router.get('/stream/:musicName', async (req, res, next) => {
  const currentSong = await songModel.findOne({
    fileName: req.params.musicName
  })

  const stream = gfsBucket.openDownloadStreamByName(req.params.musicName)

  res.set('Content-Type', 'audio/mpeg')
  res.set('Content-Length', currentSong.size + 1)
  res.set('Content-Range', `bytes 0-${currentSong.size - 1}/${currentSong.size}`)
  res.set('Content-Ranges', 'byte')
  res.status(206)

  stream.pipe(res)
})

router.get('/SongName/:musicName', isloggedIn, async function (req, res, next) {
  const currentSong = await songModel.findOne({
    fileName: req.params.musicName,
  })

  res.json({
    title:currentSong
  })
})

router.get('/search', (req, res, next) => {

  res.render('search')
})

router.get('/likeMusic/:songid', isloggedIn, async function(req, res, next){
const foundUser = await userModel.findOne({username: req.session.passport.user})
if(foundUser.likes.indexOf(req.params.songid) === -1 ){
  foundUser.likes.push(req.params.songid)
}
else{
  foundUser.likes.splice(foundUser.likes.indexOf(req.params.songid),1)
}
await foundUser.save();

const foundSong = await songModel.findOne({_id: req.params.songid })
if(foundSong.likes.indexOf(foundUser._id)=== -1) {
  foundSong.likes.push(foundUser._id)
}
else{
  foundSong.likes.splice(foundSong.likes.indexOf(foundUser._id), 1)
}
await foundSong.save()
res.redirect('back')
})


router.get('/likedMusic',isloggedIn, async (req, res, next) => {
  const songData = await userModel.findOne({username: req.session.passport.user})
  .populate("likes")
  res.render("likedMusic", {songData});
})
  

router.post("/createplaylist", isloggedIn, async function(req, res, next){
  const defaultplaylist = await playlistModel.create({
    name:req.body.playlistName,
    owner:req.user._id,

  })

  const newUser = await userModel.findOne({
    _id: req.user._id

  })

  newUser.playlist.push(defaultplaylist._id)
  await newUser.save()
  res.redirect('/')
})



router.get('/AddPlayList/:playlistid/:songid', isloggedIn, async function(req, res, next){
  const foundPlayList = await playlistModel.findOne({_id: req.params.playlistid})
  foundPlayList.songs.push(req.params.songid)
  await foundPlayList.save();
  res.redirect("/")

})

 router.get('/PlayList/:playlistid', isloggedIn, async function(req, res, next){

  const userdata = req.user
  const foundPlayList = await playlistModel.findOne({_id: req.params.playlistid})
  .populate("songs")
  res.render("playList", {foundPlayList, userdata})
 }) 

 


router.post('/search', async (req, res, next) => {

  const searhedMusic = await songModel.find({
    title: { $regex: req.body.search }
  })
  console.log(searhedMusic)

  res.json({
    songs: searhedMusic
  })

})


module.exports = router;
