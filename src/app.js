const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("./passport");
const morgan = require("morgan");
const createError = require('http-errors');


const { errorResponse } = require("./controllers/responseController");
const authRouter = require("./routes/authRoute");
//const userRouter = require("./routes/userRoute");
const plansRouter = require("./routes/plansRoute");
const webhookRouter = require("./routes/webhookRoute");
const modelsRouter = require("./routes/modelsRoute");
const proxyRouter = require("./routes/proxyRoute");



const app = express();




app.use(express.urlencoded({extended: true}));
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(morgan("dev"));
app.use(passport.initialize());







//home route
app.get("/", (req, res) =>{
    res.status(200).send("<h2>ai sorix Project</h2>");
})

//users authentication route
app.use("/api/auth/users", authRouter);

// //users route
// app.use("/api/users", userRouter);

//plans route
app.use("/api/plans", plansRouter);

//For payment getway
app.use("/api/webhook", webhookRouter);

app.use("/api/models", modelsRouter);

app.use("/api/proxy", proxyRouter);









/** ============Error Handling============ **/

//bad request
app.use((req, res, next) =>{
    next(createError(404, "bad request! path not found"));  
})

//internal server error nad all global errors
app.use((error, req, res, next) =>{
    errorResponse(res, {
        statusCode: error.status,
        message: error.message,
    })
})








module.exports = app;