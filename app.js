const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const ejs = require('ejs');
const nodemailer = require('nodemailer');
const Sentiment = require('sentiment');
var sentiment = new Sentiment();
const Chart=require('chart.js');
const application  = require(__dirname+'/src/application');
const app = express();
const multer = require('multer');
const upload = multer({dest:__dirname+'/public/uploads/'});
const fs = require('fs');
const path =require('path');
const cloudinary  = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { log } = require('console');

require('dotenv').config();


cloudinary.config({ 
    cloud_name: "dlqslehsn", 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    folder: "demo",
    allowedFormats: ["jpg", "png"],
    transformation: [{ width: 30, height: 30, crop: "limit" }]
});
const parser = multer({ storage: storage });

let transport = nodemailer.createTransport({
    service:'gmail',
    auth:{
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }

});
mongoose.connect(`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.exwfndk.mongodb.net/Book_Rental?retryWrites=true&w=majority`);
const bookSchema = {
    bookName: String,
    class: String,
    Subject: String,
    ownerName: String,
    contactInfo:String,
    bookImage:String
    
}
const Book = mongoose.model("Book",bookSchema);

const revSchema ={
    username: String,
    revcontent: String,
    revbookName: String,
    revrating: Number
}

const Rev = mongoose.model("Rev",revSchema);

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static(__dirname + "/public"));

app.get("/",(req,res)=>{
    res.render("home");
});

app.get("/lendBook",(req,res)=>{
    res.render("lendBook");
});

app.post("/lendBook",parser.single('image'),(req,res)=>{
    const book = new Book({
        bookName :req.body.bookName,
        class: req.body.class,
        Subject:req.body.subject,
        ownerName:req.body.luserName,
        contactInfo: req.body.lemail,
        bookImage:req.file.path
    })
    book.save((err,post,numAffected)=>{
        if(err){
            console.log(err);
        }else{
            res.render("lendingSuccess",{
                book:book
            });
        }
    });
});

app.get("/rentBook",(req,res)=>{
    Book.find((err,books)=>{
        if(err){
            console.log(err);
        }
        else{

            if(books.length===0){
                res.render("successFailure",{
                    heading: "No books are available now",
                    subHeading:"We are sorry for the inconvenience. Please come back later to rent books"
                });
            }
            else{
                res.render("rentBook",{
                    books:books
                });
            }
        }
    })
    

});
app.get("/rentBook/:bookId",(req,res)=>{
    let bookId = req.params.bookId;
    Book.findById({_id:bookId},(err,book)=>{
        if(!err){
            res.render("rentApplication",{
                book:book
            });
        }
        else{
            console.log(err);
        }
    })
})
app.post("/rentBook/:bookId",(req,res)=>{
    let bookId = req.params.bookId;

    Book.findById({_id:bookId},(err,book)=>{
        if(!err){
            const message = {
                from:"bookrentaldtl@gmail.com",
                to: book.contactInfo,
                subject: `New Application submitted for ${book.bookName}`,
                html: application.formatHtmlBody(req.body,book.bookName)
            }

            transport.sendMail(message,(err,info)=>{
                if(err){
                    console.log("Couldn't send mail");
                    console.log(err);
                }else{
                    res.render("successFailure",{
                        heading:"You have successfully submitted application",
                        subHeading: "Lender will get in touch with you"
                    });
                    console.log(info);
                }
            })
            
            
  
        }
        else{
            console.log(err);
        }
    })
});


app.get("/rentBook/:bookId/rev",(req,res)=>{
    let bookId = req.params.bookId;
    console.log(bookId);
    Book.findById(bookId,(err,results)=>{
        if(err){
            console.log(err);
        }
        else{
           
            console.log(results.bookName);
            var name=results.bookName;
            console.log(name);
            Rev.find({ revbookName:results.bookName},(err, docs) => {
                if (!err) {
                    console.log(docs);
                    if(docs.length===0){
                        res.render("review",{
                            docs:docs,
                            name:name
                        });
                    }
                    else{
                        res.render("review",{
                            docs:docs,
                            name:name
                        });
                    }
                    
                } else {
                    console.log('Failed to retrieve the Reviews' + err);
                    
                }
              });
        }
    });
    
    
})

app.post("/review/rev",(req,res)=>{
    console.log(req.body);
   
    var result = sentiment.analyze(req.body.revcontentname);
    // console.log(req.body.revcontentname);
    const revi = new Rev({
        username: req.body.reviewername,
        revcontent: req.body.revcontentname,
        revbookName: req.body.revbookname,
        revrating: result.comparative
    })
    console.log(revi);
    revi.save((err,post,numAffected)=>{
        if(err){
            console.log(err);
        }else{
          // res.render("lendBook");
            res.redirect("/rentBook");
        }
    });
});

app.get("/deleteBook",(req,res)=>{
    res.render("deleteBook");
});
app.post("/deleteBook",(req,res)=>{
    let bookId = req.body.bookId;

    Book.findById(bookId,(err,result)=>{
        if(!result){
            res.render("successFailure",{
                heading:"Couldn't delete the book of given id",
                subHeading: "Please try again"
            });
        }
        else if(err){
            console.log(err);
        }
        else{
            Book.findByIdAndDelete(bookId,(err,docs)=>{
                if(err){
                    console.log(err);
                }
                else{
                    res.render("successFailure",{
                        heading:"Successfully deleted the book which you listed",
                        subHeading: "Thank you for using our website"

                    });
                }
            })
           
        }

    })
    
 
});

app.get("/stats",(req,res)=>{
    
    Rev.aggregate([
        { $group: {
            _id: "$revbookName",
            total: { $sum: "$revrating"}
        }}
    ], function (err, results) {
        if (err) {
            console.error(err);
            res.render("stats");
        } else {
                             
            console.log(results);
            const help=[];
            const help1=[];
            for(i=0;i<results.length;i++)
            {
              //  console.log(results[i].total);
                help.push(results[i]._id);
                help1.push(results[i].total);
            }
            console.log(help1);
            
            res.render("stats",{
                records:results,
                help:help,
                help1:help1
            });
        }
    }
   );  
});

app.post("/stats",(req,res)=>{

});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}



app.listen((port), function () {
    console.log("Server started on port "+port);
  });