const express = require("express");
const app = express();
app.use(express.json());
const cors = require("cors");
app.use(cors());
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const PORT = 5000;

const dbPath = path.join(__dirname, "notesApp.db");
let db;

const initailizer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(PORT, () => {
      console.log("Server is running at http://localhost:5000");
    });
  } catch (e) {
    console.log(e.message);
  }
};

initailizer();

app.post("/user/register", async (request, response) => {
  const { name, email, password } = request.body;
  const nameCheck = `
        SELECT name FROM user WHERE name = "${name}"
    `;

  const emailCheck = `
        SELECT email FROM user WHERE email = "${email}"
    `;
  const checkResponse = await db.get(nameCheck);
  const emailResponse = await db.get(emailCheck);

  let isNumberPresent = false;
  let isSmallPresent = false;
  let isCapPresent = false;

  const passwordList = password.split("");

  for (let letter in passwordList) {
    let actualLetter = passwordList[letter];
    let code = actualLetter.charCodeAt(0);

    if (code > 64 && code < 91) {
      isCapPresent = true;
    }
    if (code > 96 && code < 123) {
      isSmallPresent = true;
    }
    if (code > 47 && code < 58) {
      isNumberPresent = true;
    }
  }

  if (checkResponse === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10);
    if (emailResponse === undefined) {
      const detailsUpload = `
                INSERT INTO  user  (name , email , password)
                VALUES ("${name}" , "${email}" , "${hashedPassword}");
            `;

      if (isCapPresent) {
        if (isNumberPresent) {
          if (isSmallPresent) {
            if (password.length > 6) {
              const detailsResponse = await db.run(detailsUpload);
              response.status(200);
              response.send({ message: "Registered Successfully" });
            } else {
              response.status(400);
              response.send({
                message: "password must be minimum 7 character long",
              });
            }
          } else {
            response.status(400);
            response.send({
              message: "Password must contain small case letter",
            });
          }
        } else {
          response.status(400);
          response.send({ message: "Password must contain a number" });
        }
      } else {
        response.status(400);
        response.send({
          message: "Password must contain a capital case letter",
        });
      }
    } else {
      response.status(400);
      response.send({ message: "Email already exists" });
    }
  } else {
    response.status(400);
    response.send({ message: "User alreay exists" });
  }
});

app.post("/user/login", async (request, response) => {
  const { name, password } = request.body;
  const userPassword = password;
  const checkName = `
        SELECT name FROM user WHERE name = "${name}"
    `;

  const allDataFetch = `
        SELECT * FROM user WHERE name = "${name}"
    `;
  const allDataFetchResponse = await db.all(allDataFetch);
  const checkNameResponse = await db.get(checkName);

  if (checkNameResponse === undefined) {
    response.status(400);
    response.send({ message: "user doesn't exist please register first" });
  } else {
    const { password } = allDataFetchResponse[0];
    const passCheck = await bcrypt.compare(userPassword, password);
    if (passCheck) {
      const jwtToken = jwt.sign({ username: name }, "NOTES");
      response.send({ jwtToken: jwtToken, username: name });
    } else {
      response.status(400);
      response.send({ message: "Invalid Password" });
    }
  }
});

const authFunction = async (request, response, next) => {
  try {
    const authorization = request.headers["authorization"];
    const JwtToken = authorization.split(" ")[1];
    const usernameObj = jwt.verify(JwtToken, "NOTES");
    request.username = usernameObj.username;
    if (usernameObj !== undefined) {
      next();
    } else {
      response.send({ message: "User not logged in" });
    }
  } catch (e) {
    response.send({ message: e.message });
  }
};

app.post("/user/save", authFunction, async (request, response) => {
  const { username } = request;
  const { title, content } = request.body;

  const checkTitle = `
    SELECT content FROM notes WHERE title = "${title}"
  `;

  const titleCheckResponse = await db.get(checkTitle);

  if (titleCheckResponse !== undefined) {
    const saveDataQuery = `
      UPDATE notes 
      SET title = "${title}" , content = "${content}"
      WHERE title = "${title}"
    `;

    const reponseSaveData = await db.run(saveDataQuery);
    response.send({ message: "Data saved successfully" });
  } else {
    const userIdQuery = ` 
    SELECT id FROM user WHERE name = "${username}";
  `;
    const userIdGotFromDb = await db.get(userIdQuery);
    const { id } = userIdGotFromDb;
    const saveQuery = `
      INSERT INTO notes (title , content , user_id)
      VALUES ("${title}" , "${content}" , ${id})
  `;

    const saveQueryResponse = await db.run(saveQuery);
    response.send({ message: "Data saved successfully" });
  }
});

app.get("/user/saved-notes", authFunction, async (request, response) => {
  const { username } = request;

  const userIdQuery = `
    SELECT id FROM user WHERE name = "${username}";
  `;
  const userIdGotFromDb = await db.get(userIdQuery);
  const { id } = userIdGotFromDb;

  const notesGetQuery = `
    SELECT notes_id,title , content FROM notes WHERE user_id = ${id}
  `;

  const notesGetResponse = await db.all(notesGetQuery);
  response.send(notesGetResponse);
});

app.delete("/notes/:notesId", authFunction, async (request, response) => {
  const { notesId } = request.params;
  const deleteQuery = `
    DELETE FROM notes WHERE notes_id = ${notesId}
  `;
  await db.run(deleteQuery);
});

app.get("/edit/:notesId", authFunction, async (request, response) => {
  const { notesId } = request.params;
  const editQuery = `
    SELECT title , content FROM notes WHERE notes_id = ${notesId}
  `;
  const editResponse = await db.get(editQuery);
  response.status(200);
  response.send(editResponse);
});
