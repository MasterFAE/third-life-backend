import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import Discord from "discord.js";
import dotenv from "dotenv";
import { readFileSync } from "fs";
dotenv.config({});

export var sslOptions = {
  key: readFileSync("private.key"),
  cert: readFileSync("certificate.crt"),
  ca: readFileSync("ca_bundle.crt"),
};

// export const transporter = nodemailer.createTransport({
//   // service: "Gmail",
//   host: "mail.thirdliferp.com",
//   secure: false, // upgrade later with STARTTLS
//   port: 587,
//   auth: {
//     user: process.env.MAIL_USER,
//     pass: process.env.MAIL_PASSWORD,
//   },
//   tls:{
//     rejectUnauthorized:false
//   }
// });

export const transporter = nodemailer.createTransport({
  service: "Gmail",
  port: 587,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});
transporter.verify(function (error, success) {
  if (error) {
    console.log("[ERROR]: Couldn't verify email source: " + error);
  } else {
    console.log("[NODEMAIL] Mail server is ready!");
  }
});
export const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests try again after some time",
});

export const corsOptions = function (req, callback) {
  if (process.env.MODE === "production") {
    callback(null, {
      origin: "http://localhost:3000",
      credentials: true,
    });
  } else {
    let whitelist = [
      "https://thirdliferp.com",
      "http://thirdliferp.com",
      "https://www.thirdliferp.com",
      "http://www.thirdliferp.com",
    ];
    callback(null, {
      origin: (origin, callback) => {
        if (whitelist.includes(origin)) return callback(null, true);
        callback("ERROR: Not authorized");
      },
      credentials: true,
    });
  }
};
export const discordClient = new Discord.Client({ intents: Discord.Intents.FLAGS.GUILDS });
discordClient.on("ready", () => {
  console.log(`[DISCORD] Discord bot is ready!`);
});
discordClient.login(process.env.DISCORD_BOT_TOKEN);
