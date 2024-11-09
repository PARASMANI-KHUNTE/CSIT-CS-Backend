const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
const dotenv = require("dotenv");
dotenv.config();
const port = process.env.PORT || 9080 ;
const db  = require('./Database/Db.js')
db()
app.use(express.json())
const Auth = require('./Routes/Auth.js');

app.use("/api/auth",Auth);


app.listen(port,()=>{
    console.log(`Server is running on http://localhost:${port}`);
})