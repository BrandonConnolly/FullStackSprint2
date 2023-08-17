const dal = require("./p.db");

async function getUserData() {
  let SQL = `SELECT id, user_id, keywords, uuid, created_at FROM public."userdata"`;
  try {
    let results = await dal.query(SQL, []);
    return results.rows;
  } catch (error) {
    console.log(error);
  }
}

async function getUserDataByUserId(user_id) {
  let SQL = `SELECT id, user_id, keywords, uuid, created_at FROM public."userdata" WHERE user_id = $1`;
  try {
    let results = await dal.query(SQL, [user_id]);
    return results.rows[0];
  } catch (error) {
    console.log(error);
  }
}

async function addUserData(user_id, keywords, uuid) {
  let SQL = `INSERT INTO public."userdata"(user_id, keywords, uuid)
    VALUES ($1, $2, $3) RETURNING id;`;
  try {
    let results = await dal.query(SQL, [user_id, keywords, uuid]);
    return results.rows[0].id;
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  getUserData,
  addUserData,
  getUserDataByUserId,
};
