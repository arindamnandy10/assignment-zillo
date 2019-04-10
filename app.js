const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const crypto = require('crypto');
const mongoose = require('mongoose');
const GridFsStorage = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const methodOverride = require('method-override');
const ejs = require('ejs');
const path = require('path');

//Init app
const app = express();

//Middleware
app.use(bodyParser.json());
app.use(methodOverride('_method'));

//View Engine setup
app.set('view engine', 'ejs');

//MongoURI
const dbURI = "mongodb://leo:abc123@ds135776.mlab.com:35776/mongouploads";

//Create MongoDB connection
const con = mongoose.createConnection(dbURI);

//Init gfs
let gfs;

con.once('open', (req, res) => {
    gfs = Grid(con.db, mongoose.mongo);
    gfs.collection('uploads');
})

//Create storage engine
const storage = new GridFsStorage({
    url: dbURI,
    file: (req, file) => {
      return new Promise((resolve, reject) => {
        crypto.randomBytes(16, (err, buf) => {
          if (err) {
            return reject(err);
          }
          const filename = buf.toString('hex') + path.extname(file.originalname);
          const fileInfo = {
            filename: filename,
            bucketName: 'uploads'
          };
          resolve(fileInfo);
        });
      });
    }
  });
const upload = multer({
    storage: storage,
    fileFilter: function(req, file, cb){
        checkFileType(file, cb);
    }
});

//Check File Type
function checkFileType(file, cb){
    //allowed extensions
    const filetypes = /jpeg|jpg|png|gif/;
    //Check extension
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    //Check mime
    const mimetype = filetypes.test(file.mimetype);

    if(mimetype && extname){
        return cb(null, true);
    } else {
        cb('Error: Images only!!')
    }
}

//@route GET/
//@desc loads from
app.get('/', (req, res) => {
    gfs.files.find().toArray((err, files) => {
        //Check if files
        if(!files || files.length === 0){
            res.render('index', {files: false});
        } else {
            files.map(file => {
                if(file.contentType === 'image/jpeg' || file.contentType === 'image/jpg' || file.contentType === 'image/png' || file.contentType === 'image/gif'){
                    file.isImage = true;
                } else {
                    file.isImage = false;
                }
            });
            res.render('index', {files: files});
        }
    });
});

//@route POST/
//@desc Uploads file into DB
app.post('/upload', upload.single('file'), (req, res, err) => {
   // res.json({file: req.file});
   if(err){
    res.render('index', {
        msg: err
    });
   } else {
       if(req.file == undefined){
           res.render('index', {
               msg: 'Error: No Image Selected.'
           })
       } else {
           res.redirect('/');
       }
   }
})

//@route GET /images/:filename
//@desc display all files in json
app.get('/images/:filename', (req, res) => {
    gfs.files.findOne({filename: req.params.filename}, (err, file) => {
        //Check if files
        if(!file || file.length === 0){
            return res.status(404).json({
                err: 'No image exists here. Please upload a few first.'
            });
        }

        //Check if image
        if(file.contentType === 'image/jpeg' || file.contentType === 'image/jpg' || file.contentType === 'image/png' || file.contentType === 'image/gif'){
            //Read output to browser
            const readstream = gfs.createReadStream(file.filename);
            readstream.pipe(res);
        } else {
            return res.status(404).json({
                err: 'Not an image.'
            });
        }
    });
});

const port = 3000;

app.listen(port, () => console.log(`Server started on port ${port}`));