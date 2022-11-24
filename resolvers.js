import bcrypt from "bcrypt";
import { db } from "./index.js";
import { generateJWT, verifyJWT } from "./lib/jwt.utils.js";
import { QuestionPicker, TestValidator, Rules, Admins } from "./lib/quiz.util.js";
import { transporter, discordClient } from "./lib/utils.js";
import { validationResult } from "express-validator";
import dotenv from "dotenv";
dotenv.config();

export const Token = (req, res) => {
  if (!req.user) return res.json();
  const getAnnouncementsQuery =
    "SELECT * FROM forum_announcements WHERE whitelist = ? ORDER BY createdAt LIMIT 15; SELECT * FROM forum_updates ORDER BY createdAt LIMIT 15";
  db.query(getAnnouncementsQuery, [req.user.whitelist], function (error, result) {
    if (error) return res.status(400).json({ error });
    let updates = result[1];
    let announcements = result[0];
    res.json({ user: req.user, updates, announcements });
  });
};

export const Register = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: "Lütfen girdiğiniz bilgileri tekrar kontrol edin!" });
  }
  const { password, email, username, discord, steam } = req.body;
  if (email.length == 0 || password.length == 0 || username.length == 0 || discord.length == 0 || steam.length == 0) {
    res.status(400).json({ error: "Lütfen tüm alanları doldurun!" });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Şifre en az 6 karakter içermeli" });
    return;
  }
  if (typeof email !== "undefined") {
    let lastAtPos = email.lastIndexOf("@");
    let lastDotPos = email.lastIndexOf(".");
    if (
      !(lastAtPos < lastDotPos && lastAtPos > 0 && email.indexOf("@@") == -1 && lastDotPos > 2 && email.length - lastDotPos > 2)
    ) {
      res.status(400).json({ error: "Lütfen geçerli email girin!" });
      return;
    }
  }

  if (typeof username !== "undefined") {
    if (!username.match(/^[a-zA-Z0-9]+$/i)) {
      res.status(400).json({ error: "Kullanıcı isminde sadece harf ve sayılar kullanılabilir!" });
      return;
    }
  }
  let steamIndex = steam.lastIndexOf("steam");
  let otherIndex = steam.lastIndexOf(":");
  if (
    steam.length < 10 ||
    typeof steam === "undefined" ||
    otherIndex === -1 ||
    steamIndex === -1 ||
    (steamIndex !== 0 && otherIndex !== 5)
  ) {
    res.status(400).json({ error: "Lütfen geçerli steam hex kodu giriniz!" });
    return;
  }

  if (discord.length < 15 || parseInt(discord) === NaN || typeof discord === "undefined") {
    res.status(400).json({ error: "Lütfen geçerli discord ID giriniz! [Ör: 140141541854281728]" });
    return;
  }

  const CheckEmail = "SELECT username,email,steam,discord FROM forum_accounts WHERE email = ? OR username = ? OR steam = ? OR discord = ?";
  db.query(CheckEmail, [email, username, steam, discord], function (err, result) {
    if (result && result.length > 0) {
      let errormsg = "";
      result.map((item) => {
        if (item.email == email) errormsg = "Bu email zaten kullanılıyor.";
        else if (item.username == username) errormsg = "Bu kullanıcı ismi zaten kullanılıyor.";
        else if(item.steam == steam) errormsg = "Bu steam hex zaten kullanılıyor."
        else if(item.discord == discord) errormsg = "Bu discord hesabı zaten kullanılıyor."
      });
      res.status(400).json({ error: errormsg });
      return;
    }
    bcrypt.hash(password, 10, function (err, hash) {
      if (err) {
        console.error("ERROR ACCURED WHILE HASHING: " + err);
        res.status(400);
        return;
      }
      const saltedPassword = hash;
      const SqlInsert = "INSERT INTO forum_accounts (email, username, password, steam, discord) VALUES (?,?,?,?,?)";
      db.query(SqlInsert, [email, username, saltedPassword, steam, discord], function (err, result) {
        if (err) {
          console.error("ERROR ACCURED WHILE CREATING USER: " + err);
          res.status(400);
          return;
        }
        const emailToken = generateJWT({ email }, 2, "7d");
        let url = `https://thirdliferp.com/login/${emailToken}`; // THIS WON'T WORK NEED TO UPDATE
        transporter.sendMail(
          {
            from: "Third Life Roleplay", // sender address
            to: email, // list of receivers
            subject: "Third Life'a Hoşgeldin!", // Subject line
            // text: "T",
            html: `
              <center>
                <h1> Aramıza hoşgeldin! ${username}</h1><br />
                <b> Lütfen kaydınızı tamamlamak için alttaki linke tıklayarak emailinizi onaylayın! </b><br />
                <a href="${url}">Doğrula</a><br /><br />
                Eğer link çalışmıyorsa kopyalayıp deneyin: <br /> <a>${url}</a>
              </center>
              `, // html body
          },
          function (err, info) {
            if (err) {
              console.log(`[ERROR]: COULDN'T SEND MAIL WHILE REGISTERING: ${err}`);
            }
            res.status(200).json({ status: "Kullanıcı Oluşturuldu" });
          }
        );
      });
    });
  });
};

export const Login = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: "Lütfen girdiğiniz bilgileri tekrar kontrol edin!" });
  }
  const { username, password } = req.body;
  const userquery = "SELECT * FROM forum_accounts WHERE username = ?";
  db.query(userquery, [username], function (err, dbresult) {
    if (dbresult && dbresult.length !== 1) return res.status(400).json({ error: "Kullanıcı ismi veya şifre yanlış!" });
    if (dbresult[0].mailConfirmed === 0)
      return res.status(400).json({ error: "Giriş yapabilmek için mail adresini doğrulamanız gerekli" });
    bcrypt.compare(password, dbresult[0].password, function (err, result) {
      if (!result) return res.status(400).json({ error: "Kullanıcı ismi veya şifre yanlış!" });
      const { id, whitelist, username, isAdmin, isModerator, steam, discord } = dbresult[0];
      const user = {
        id,
        whitelist,
        username,
        isAdmin,
        isModerator,
        steam,
        discord,
      };
      const authToken = generateJWT(user, 0, "5");
      const refreshToken = generateJWT(user, 1);

      const createRefreshTokenQuery = "INSERT INTO forum_refreshtoken (refreshtoken, userid) VALUES (?,?)";
      db.query(createRefreshTokenQuery, [refreshToken, user.id], function (error, result) {
        if (error) return res.status(400).json({ error });
      });
      const getAnnouncementsQuery =
        "SELECT * FROM forum_announcements WHERE whitelist = ? ORDER BY createdAt LIMIT 15; SELECT * FROM forum_updates ORDER BY createdAt LIMIT 15";
      db.query(getAnnouncementsQuery, [whitelist], function (error, result) {
        if (error) return res.status(400).json({ error });
        let announcements = result[0];
        let updates = result[1];
        res.cookie("refreshToken", refreshToken, { maxAge: 3.154e10, httpOnly: true, secure: true, sameSite: "none" });
        res.cookie("authToken", authToken, { maxAge: 1000000, httpOnly: true, secure: true, sameSite: "none" });
        res.json({ user: user, updates, announcements });
      });
    });
  });
};

export const LogOff = (req, res) => {
  const { refreshToken } = req.cookies;
  const { payload, expired } = verifyJWT(refreshToken, 1);
  if (!payload || expired) return res.status(400);
  const logoffquery1 = "DELETE FROM forum_refreshtoken WHERE userid = ?";
  db.query(logoffquery1, [payload.id], function (error, result) {
    if (error) return res.status(400).json({ error });
    res.cookie("authToken", "", { maxAge: 0, httpOnly: true, secure: true, sameSite: "none" });
    res.cookie("refreshToken", "", { maxAge: 0, httpOnly: true, secure: true, sameSite: "none" });
    res.send("Çıkış Yapıldı");
    res.status(200);
  });
};

export const WhitelistBasvuruPost = (req, res) => {
  const { userid, discord, id } = req.body;
  const { correct, wrong, test } = TestValidator(req.body.test);
  let result = 0;
  if (correct >= process.env.WHITELIST_APPLICATION_REQUIRED_CORRECT_ANSWERS) {
    result = 1;
  }

  const basvuruQuery =
    "UPDATE forum_whitelist_applications SET correct = ?, wrong = ?, result = ?, isFinished = ?, questions = ?, isActive = ? WHERE userid = ? AND id = ?; UPDATE forum_accounts SET canApply = ? WHERE id = ?";
  db.query(
    basvuruQuery,
    [correct, wrong, result, 1, JSON.stringify(test), 0, userid, id, 0, userid],
    function (error, dataResult) {
      if (error) return res.status(400).json({ error }); //need error handling in client
      if (result === 1) {
        const guild = discordClient.guilds.cache.get(process.env.DISCORD_MULAKAT_GUILD);
        const role = guild.roles.cache.get(process.env.DISCORD_MULAKAT_PERM);
        guild.members.fetch(discord).then((member) => {
          try {
            member.roles.add(role);
            res.json({
              result,
            });
          } catch (err) {
            console.log(err);
            res.status(400);
          }
        });
      } else {
        res.json({
          result,
        });
      }
    }
  );
};

export const WhitelistBasvuruController = (req, res) => {
  const selectQuery = "SELECT canApply FROM forum_accounts WHERE id = ?";
  db.query(selectQuery, [req.user.id], function (err, result) {
    if (result && result.length <= 0) return res.status(400).json({ error: "Geçersiz Kullanıcı" });
    return res.json({ canApply: result[0].canApply });
  });
};

export const WhitelistBasvuruGet = (req, res) => {
  const selectQuery = "SELECT * FROM forum_whitelist_applications WHERE userid = ?";
  db.query(selectQuery, [req.user.id], function (err, res1) {
    if (res1 && res1.length > 0) {
      if (res1[0].isFinished === 1) {
        return res.json({ error: "Aktif bir başvurun mevcut" });
        // return res.redirect("http://localhost:3000/whitelist-basvuru");
      }
      let test = { questions: JSON.parse(res1[0].questions), id: res1[0].id };
      res.json(test);
    } else {
      let questions = QuestionPicker();
      const basvuruQuery =
        "INSERT INTO forum_whitelist_applications (userid, questions, correct, wrong, result) VALUES (?,?,?,?,?)";
      db.query(basvuruQuery, [req.user.id, JSON.stringify(questions), 0, 0, 0], function (error, result) {
        if (error) return res.status(400).json({ error });
        let test = { questions, id: result.insertId };
        res.json(test);
      });
    }
  });
};

export const EmailConfirmation = (req, res) => {
  const { token } = req.params;
  // var EMAIL_TOKEN_LIST = []; // NEED TO DESTROY THE TOKEN
  // if (EMAIL_TOKEN_LIST.includes(token)) {
  //   res.redirect("http://localhost:3000/login");
  //   return;
  // }

  const { payload, expired } = verifyJWT(token, 2);

  if (!payload) return res.status(400).json({ error: "Not valid token" });

  const emailQuery = "UPDATE forum_accounts SET mailConfirmed = '1' WHERE email = ?";
  db.query(emailQuery, [payload.email], function (error, result) {
    if (error) return res.status(400).json({ error: "ERROR: Couldn't validate email!" });
    // EMAIL_TOKEN_LIST.push(token);
    return res.json({ message: "Hesap başarıyla onaylandı!" });
    // return res.redirect("http://localhost:3000/login/confirmed=true");
  });
};

export const ForgotPasswordRequest = (req, res) => {
  const { email, confirmEmail } = req.body;
  /*
SANITIZING && CHEK EQUALS
*/
  const checkEmail = "SELECT id FROM forum_accounts WHERE email = ?";
  db.query(checkEmail, [email], function (error, result) {
    if (error) return res.status(400).json({ error });
    if (result.length > 0) {
      const passwordToken = generateJWT({ id: result[0].id }, 2, "15m");
      let url = `http://localhost:5555/password/${passwordToken}`; // Client server'inde olmalı ve isteği oradan yollamalı.
      transporter.sendMail(
        {
          from: "Third Life Roleplay", // sender address
          to: email, // list of receivers
          subject: "Third Life Şifre sıfırlama!", // Subject line
          // text: "T",
          html: `
              <center>
                <h1> Merhaba!</h1><br />
                <b> Şifrenizi sıfırlamak için aşağıdaki butona tıklayınız.</b><br />
                <b> Eğer bu isteği siz yapmadıysanız lütfen yetkililerle iletişime geçiniz! </b><br />
                <a href="${url}">Doğrula</a><br /><br />
                Eğer link çalışmıyorsa kopyalayıp deneyin: <br /> <a>${url}</a>
              </center>
              `, // html body
        },
        function (err, info) {
          if (err) {
            console.log(`[ERROR]: COULDN'T SEND MAIL WHILE REGISTERING: ${err}`);
            return;
          }
          res.status(200).json({ message: "Şifre değiştirme talebi yollandı" });
        }
      );
    }
  });
};

export const ForgotPassword = (req, res) => {
  const { token, password, confirmPassword } = req.body;

  /*
    SANITIZING && CHEK EQUALS
  */
  const { payload, expired } = verifyJWT(token);
  if (!payload || expired) return res.status(400).json({ error: "Token is not valid" });
  bcrypt.hash(password, 10, function (err, hash) {
    if (err) {
      console.error("ERROR ACCURED WHILE HASHING: " + err);
      res.status(400);
      return;
    }
    const saltedPassword = hash;
    const passwordQuery = "UPDATE forum_accounts SET password = ? WHERE id = ?";
    db.query(passwordQuery, [saltedPassword, payload.id], function (error, result) {
      return res.json({ message: "Şifre başarıyla güncellendi" });
    });
  });
};

export const GetRules = (req, res) => {
  const rules = Rules();
  res.json(rules);
};

//NOT SURE!
export const GetAdmins = (req, res) => {
  const admins = Admins();
  res.json(admins);
};
