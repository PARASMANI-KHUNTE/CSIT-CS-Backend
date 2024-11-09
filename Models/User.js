const mongoDb = require('mongoose');

const userSchema  = new mongoDb.Schema({
    Fname : {
        type : String ,
    },
    Lname : {
        type : String ,
    },
    Email : {
        type : String ,
    },
    Phone : {
        type : Number ,
    },
    Department : {
        type : String 
    },
    School : {
        type : String ,
    },
    GGVID : {
        type : String ,
        unique : true
    },
    Type : {
        type : String ,
    },
    JoiningDate  : {
        type : Date,
        default: Date.now
    },
    UserId : {
        type : String ,
        unique : true
    },
    password  : {
        type : String ,
    }

}); 


const User = mongoDb.model("User" , userSchema);

module.exports = User;