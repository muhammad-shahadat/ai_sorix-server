
const {Pool} = require("pg");


const { dbHost, dbUser, dbName, dbPort, dbPassword } = require("../src/secret");


const pool = new Pool({
  host: dbHost,
  user: dbUser,
  database: dbName,
  password:dbPassword,
  port: dbPort,

  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  maxLifetimeSeconds: false
})

module.exports = pool;
