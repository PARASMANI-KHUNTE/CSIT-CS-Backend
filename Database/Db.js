const mongoose = require("mongoose");
const mongoDbUri = process.env.mongoDbUri;
const DbName = process.env.DbName;

const db = async () => {
    try {
        const con = await  mongoose.connect(`${mongoDbUri}/${DbName}`);
        if(con){
            console.log("Database Server is connected");
        }else{
            console.log("Database Failed to connect");
        }
    } catch (error) {
        console.log(`Error - ${error}`);
    }
}

module.exports = db;