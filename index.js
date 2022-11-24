import express from "express";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";
import mysql from "mysql";
import bodyParser from "body-parser";
import https from "https";
import http from "http";
import cookieParser from "cookie-parser";
import { UserChecker, requireUser } from "./lib/middleware.js";
import { corsOptions, limiter, sslOptions } from "./lib/utils.js";
import { body } from "express-validator";
import {
  Register,
  WhitelistBasvuruGet,
  Login,
  LogOff,
  GetRules,
  WhitelistBasvuruPost,
  WhitelistBasvuruController,
  EmailConfirmation,
  Token,
} from "./resolvers.js";
import dotenv from "dotenv";
dotenv.config();

export var db = null;

const app = express();

app.use(cookieParser());
app.use(bodyParser.json());
app.set("trust proxy", 1);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(limiter);
app.use(helmet());
app.use(morgan("common"));
app.use(UserChecker);
app.use(cors(corsOptions));

if (process.env.MODE == "DEV") {
  db = mysql.createPool({
    host: process.env.DEV_DB_HOST,
    user: process.env.DEV_DB_USER,
    password: process.env.DEV_DB_PASSWORD,
    database: process.env.DEV_DB,
    multipleStatements: true,
  });
  db.getConnection(function (err, connection) {
    if (err) {
      console.log("[MYSQL] ERROR WHILE CONNECTING -> " + err);
    }
    console.log("[MYSQL] SUCCESFULLY CONNECTED");
  });
  app.listen(process.env.SERVER_PORT, () => {
    console.log(
      "[PRODUCTION] Ready and listening on port:" + process.env.SERVER_PORT
    );
  });
} else {
  db = mysql.createPool({
    host: process.env.PROD_DB_HOST,
    user: process.env.PROD_DB_USER,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB,
    multipleStatements: true,
  });
  db.getConnection(function (err, connection) {
    if (err) {
      console.log("[MYSQL] ERROR WHILE CONNECTING -> " + err);
    }
    console.log("[MYSQL] SUCCESFULLY CONNECTED");
  });
  http.createServer(app).listen(8080);
  https.createServer(sslOptions, app).listen(process.env.SERVER_PORT, () => {
    console.log(
      "[SERVER] Ready and listening on port:" + process.env.SERVER_PORT
    );
  });
}

app.post("/token", Token);

app.get("/whitelist-basvuru", requireUser, WhitelistBasvuruGet);

app.post("/whitelist-basvuru", requireUser, WhitelistBasvuruPost);
app.post("/whitelist-basvuru-kontrol", requireUser, WhitelistBasvuruController);

app.delete("/logoff", requireUser, LogOff);

app.post(
  "/login",
  body("username").not().isEmpty().trim().escape(),
  body("password").not().isEmpty().trim().escape(),
  Login
);

app.post(
  "/register",
  body("username").not().isEmpty().trim().escape(),
  body("email").isEmail().normalizeEmail(),
  body("steam").not().isEmpty().trim().escape(),
  body("discord").not().isEmpty().trim().escape(),
  body("password").not().isEmpty().trim().escape(),
  Register
);

app.get("/rules", requireUser, GetRules);

app.get("/confirmation/:token", EmailConfirmation);
