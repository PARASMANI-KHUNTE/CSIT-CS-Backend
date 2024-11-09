const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
const dotenv = require("dotenv");
const cookieParser = require('cookie-parser');
dotenv.config();
const port = process.env.PORT || 9080 ;
const db  = require('./Database/Db.js')
db()
app.use(express.json())
app.use(cookieParser());
const Auth = require('./Routes/Auth.js');

app.use("/api/auth",Auth);


app.listen(port,()=>{
    console.log(`Server is running on http://localhost:${port}`);
})